import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RecipeSteps } from "../../../../../../src/modules/recipes/components/steps/RecipeSteps";
import { StepList } from "../../../../../../src/modules/recipes/components/steps/StepList";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const steps = [
  { id: "mix", recipeId: "abc", position: 1, description: "Mixer." },
  { id: "serve", recipeId: "abc", position: 2, description: "Servir." },
];
const button = (name: string) => screen.getByRole("button", { name });

function deferredRead() {
  let respond!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    respond = resolve;
  });
  return { pending, respond };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

test("Given an initial preparation read, When it completes before 200 ms, Then the steps appear immediately without a loading flash", async () => {
  vi.useFakeTimers();
  const read = deferredRead();
  vi.stubGlobal("fetch", () => read.pending);
  render(<RecipeSteps id="abc" />);

  await advance(199);
  expect(screen.queryByText("Chargement des étapes…")).toBeNull();
  await act(async () => read.respond(Response.json(steps)));
  screen.getByText("Mixer.");
  await advance(200);
  expect(screen.queryByText("Chargement des étapes…")).toBeNull();
});

test("Given a pending preparation read, When it reaches 200 ms and then fails, Then a discreet status gives way immediately to the error and a GET retry", async () => {
  vi.useFakeTimers();
  const read = deferredRead();
  const fetch = vi
    .fn<() => Promise<Response>>()
    .mockReturnValueOnce(read.pending)
    .mockResolvedValueOnce(Response.json([]));
  vi.stubGlobal("fetch", fetch);
  render(<RecipeSteps id="abc" />);

  await advance(199);
  expect(screen.queryByText("Chargement des étapes…")).toBeNull();
  await advance(1);
  expect(screen.getByRole("status").textContent).toBe("Chargement des étapes…");
  await act(async () => read.respond(new Response(null, { status: 503 })));
  expect(screen.queryByText("Chargement des étapes…")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe(
    "Impossible de charger les étapes.",
  );
  await act(async () => {
    fireEvent.click(button("Réessayer"));
  });
  screen.getByText("Aucune étape.");
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("Given a different recipe ID during a read, When the old read settles and its timer would expire, Then only the new read can display steps or a loading message", async () => {
  vi.useFakeTimers();
  const previous = deferredRead();
  const current = deferredRead();
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/abc/steps")) return Response.json(steps);
    return url.endsWith("/def/steps") ? previous.pending : current.pending;
  });
  const view = await act(async () => render(<RecipeSteps id="abc" />));
  screen.getByText("Mixer.");
  view.rerender(<RecipeSteps id="def" />);
  expect(screen.queryByText("Mixer.")).toBeNull();
  await advance(100);
  view.rerender(<RecipeSteps id="ghi" />);
  await act(async () =>
    previous.respond(
      Response.json([{ ...steps[0], recipeId: "def", description: "Battre." }]),
    ),
  );
  await advance(100);
  expect(screen.queryByText("Battre.")).toBeNull();
  expect(screen.queryByText("Chargement des étapes…")).toBeNull();
  await advance(100);
  screen.getByText("Chargement des étapes…");
  await act(async () => current.respond(Response.json([])));
  screen.getByText("Aucune étape.");
  expect(screen.queryByText("Battre.")).toBeNull();
});

// jsdom has neither pointer capture nor layout; supply the hit row explicitly.
function touch(
  handle: HTMLElement,
  type: string,
  hit?: Element,
  clientY = 200,
) {
  if (!handle.hasPointerCapture) {
    const pointers = new Set<number>();
    handle.setPointerCapture = vi.fn((id) => pointers.add(id));
    handle.hasPointerCapture = (id) => pointers.has(id);
    handle.releasePointerCapture = vi.fn((id) => pointers.delete(id));
  }
  document.elementFromPoint = () => hit ?? document.body;
  fireEvent(
    handle,
    Object.assign(
      new MouseEvent(type, { bubbles: true, clientX: 50, clientY }),
      {
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
      },
    ),
  );
}

test.each(["pointerup", "pointercancel", "lostpointercapture", "unmount"])(
  "Given a stationary touch near the viewport edge, When auto-scroll reveals a new row, Then its marker updates and scrolling stops on %s",
  async (ending) => {
    vi.stubGlobal("fetch", async () => Response.json(steps));
    const view = render(<RecipeSteps id="abc" />);
    const [first, last] = await screen.findAllByRole("listitem");
    const handle = button("Déplacer l’étape 1");
    screen.getByRole("list").getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: -20, width: 400, height: 2000 });
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      frame = fn;
      return 17;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frame = undefined;
    });
    const scroll = vi.fn(() => {
      document.elementFromPoint = () => last;
    });
    vi.stubGlobal("scrollBy", scroll);
    touch(handle, "pointerdown");
    touch(handle, "pointermove", first, innerHeight - 5);
    expect(last.hasAttribute("data-drop")).toBe(false);
    if (!frame) throw new Error("Expected an auto-scroll animation frame.");
    const tick = frame;
    act(() => tick(performance.now() + 16));
    expect(scroll.mock.calls.length).toBe(1);
    expect(last.getAttribute("data-drop")).toBe("after");
    if (ending === "unmount") view.unmount();
    else touch(handle, ending, first);
    expect(frame).toBeUndefined();
  },
);

test("Given a touch drag, When cancelled, released outside, or dropped in place, Then no step write is sent", async () => {
  const fetch = vi.fn(async () => Response.json(steps));
  vi.stubGlobal("fetch", fetch);
  render(<RecipeSteps id="abc" />);
  const [first, last] = await screen.findAllByRole("listitem");
  const handle = button("Déplacer l’étape 1");
  for (const cancel of [
    "pointercancel",
    "lostpointercapture",
    "Escape",
    "outside",
    "same",
  ]) {
    touch(handle, "pointerdown");
    touch(handle, "pointermove", last);
    expect(last.getAttribute("data-drop")).toBe("after");
    if (cancel === "Escape") await userEvent.keyboard("{Escape}");
    else if (cancel !== "outside" && cancel !== "same") touch(handle, cancel);
    touch(
      handle,
      "pointerup",
      cancel === "same" ? first : cancel === "outside" ? undefined : last,
    );
    expect(last.hasAttribute("data-drop")).toBe(false);
  }
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("Given a failed touch move, When I retry, Then competing writes stay blocked until canonical positions load", async () => {
  const writes: unknown[] = [];
  const refresh = deferredRead();
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (init.method === "PATCH") {
      writes.push([url, JSON.parse(String(init.body))]);
      return writes.length === 1
        ? new Response(null, { status: 503 })
        : new Promise<Response>((r) => {
            finish = r;
          });
    }
    return writes.length === 2 ? refresh.pending : Response.json(steps);
  });
  render(
    <>
      <button type="button">Autre contrôle</button>
      <RecipeSteps id="abc" />
    </>,
  );
  const [first, last] = await screen.findAllByRole("listitem");
  const handle = button("Déplacer l’étape 1");
  touch(handle, "pointerdown");
  touch(handle, "pointerup", last);
  await screen.findByRole("alert");
  await userEvent.click(button("Réessayer"));
  screen.getByText("Déplacement de l’étape…");
  for (const label of [
    "Ajouter une étape",
    "Modifier l’étape 2",
    "Supprimer l’étape 1",
  ])
    await userEvent.click(button(label));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(handle.getAttribute("aria-disabled")).toBe("true");
  await act(async () => finish(Response.json({ ...steps[0], position: 2 })));
  expect(screen.queryByText("Déplacement de l’étape…")).toBeNull();
  expect(screen.getAllByRole("listitem")[0]).toBe(first);
  expect(screen.getAllByRole("listitem")[1]).toBe(last);
  expect(handle.getAttribute("aria-disabled")).toBe("true");
  await userEvent.click(button("Autre contrôle"));
  await act(async () =>
    refresh.respond(
      Response.json([
        { ...steps[1], position: 1 },
        { ...steps[0], position: 2 },
      ]),
    ),
  );
  expect(screen.getAllByRole("listitem")[0]).toBe(last);
  expect(handle.getAttribute("aria-disabled")).toBe("false");
  expect(document.activeElement).toBe(button("Autre contrôle"));
  expect(writes).toEqual(
    Array(2).fill(["/v1/recipes/recipes/abc/steps/mix", { position: 2 }]),
  );
});

test("Given a focused move handle, When I open the editor with Enter and dismiss with Escape, Then focus returns to the handle", async () => {
  vi.stubGlobal("fetch", async () => Response.json(steps));
  render(<RecipeSteps id="abc" />);
  const handle = await screen.findByRole("button", {
    name: "Déplacer l’étape 1",
  });
  handle.focus();
  await userEvent.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByLabelText("Instruction"));
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(handle);
});

test("Given a held drag, When I open a dialog with the keyboard and insert before the old source, Then releasing after refresh sends no PATCH and a new drag uses the new order", async () => {
  const refresh = deferredRead();
  const writes: { method: string; url: string; body: unknown }[] = [];
  const inserted = { ...steps[0], id: "prep", description: "Préparer." };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (init.method) {
      writes.push({
        method: init.method,
        url,
        body: JSON.parse(String(init.body)),
      });
      return Response.json({});
    }
    if (!writes.length) return Response.json(steps);
    if (writes.length === 1) return refresh.pending;
    return Response.json([
      inserted,
      { ...steps[1], position: 2 },
      { ...steps[0], position: 3 },
    ]);
  });
  render(<RecipeSteps id="abc" />);
  const [, last] = await screen.findAllByRole("listitem");
  const handle = button("Déplacer l’étape 1");
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 17;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  handle.focus();
  touch(handle, "pointerdown");
  touch(handle, "pointermove", last, innerHeight - 5);
  expect(frame).toBeDefined();
  expect(last.getAttribute("data-drop")).toBe("after");

  await userEvent.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByLabelText("Instruction"));
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
  expect(handle.hasPointerCapture(7)).toBe(false);
  expect(frame).toBeUndefined();
  expect(last.hasAttribute("data-drop")).toBe(false);
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(handle);

  button("Ajouter une étape").focus();
  await userEvent.keyboard("{Enter}");
  fireEvent.change(screen.getByLabelText("Instruction"), {
    target: { value: "Préparer." },
  });
  fireEvent.change(screen.getByLabelText("Position (facultative)"), {
    target: { value: "1" },
  });
  await act(async () => {
    fireEvent.click(button("Ajouter"));
  });
  await act(async () =>
    refresh.respond(
      Response.json([
        inserted,
        { ...steps[0], position: 2 },
        { ...steps[1], position: 3 },
      ]),
    ),
  );
  expect(button("Déplacer l’étape 2")).toBe(handle);
  expect(last.getAttribute("value")).toBe("3");
  touch(handle, "pointerup", last);
  expect(writes.map(({ method }) => method)).toEqual(["POST"]);

  touch(handle, "pointerdown");
  touch(handle, "pointermove", last);
  await act(async () => {
    touch(handle, "pointerup", last);
  });
  expect(writes[1]).toEqual({
    method: "PATCH",
    url: "/v1/recipes/recipes/abc/steps/mix",
    body: { position: 3 },
  });
  expect(writes).toHaveLength(2);
});

test.each(["a controls lock", "a new snapshot"])(
  "Given an active drag, When %s invalidates it, Then releasing cannot move a step even when controls are enabled again",
  (interruption) => {
    const move = vi.fn();
    const props = {
      edit: vi.fn(),
      remove: vi.fn(),
      move,
      fallback: { current: null },
    };
    const view = render(<StepList {...props} steps={steps} blocked={false} />);
    const [, last] = screen.getAllByRole("listitem");
    const handle = button("Déplacer l’étape 1");
    touch(handle, "pointerdown");
    touch(handle, "pointermove", last);
    expect(last.getAttribute("data-drop")).toBe("after");

    const locked = interruption === "a controls lock";
    const snapshot = locked
      ? steps
      : steps.map((step) => ({ ...step, description: `${step.description}!` }));
    view.rerender(<StepList {...props} steps={snapshot} blocked={locked} />);
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(last.hasAttribute("data-drop")).toBe(false);

    view.rerender(<StepList {...props} steps={snapshot} blocked={false} />);
    touch(handle, "pointerup", last);
    expect(move).not.toHaveBeenCalled();
  },
);

test("Given a step form, When I leave the edit unchanged or retry a failed append, Then only the append is written without position", async () => {
  const writes: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    if (init.method) {
      writes.push(JSON.parse(String(init.body)));
      return writes.length === 1
        ? new Response(null, { status: 400 })
        : Response.json({});
    }
    return Response.json(
      writes.length === 2
        ? [...steps, { id: "eat", position: 3, description: "Goûter." }]
        : steps,
    );
  });
  render(<RecipeSteps id="abc" />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Modifier l’étape 1" }),
  );
  await userEvent.click(button("Enregistrer"));
  expect(writes).toEqual([]);
  await userEvent.click(button("Ajouter une étape"));
  const dialog = within(screen.getByRole("dialog"));
  await userEvent.type(dialog.getByLabelText("Instruction"), "Goûter.");
  await userEvent.click(button("Ajouter"));
  expect((await dialog.findByRole("alert")).textContent).toContain("réessayer");
  expect(
    (dialog.getByLabelText("Instruction") as HTMLTextAreaElement).value,
  ).toBe("Goûter.");
  await userEvent.click(button("Ajouter"));
  await screen.findByText("Goûter.");
  expect(writes).toEqual([
    { description: "Goûter." },
    { description: "Goûter." },
  ]);
});

test("Given a confirmed delete and failed refresh, When I retry, Then retained rows stay locked until compacted positions load without a second delete", async () => {
  vi.useFakeTimers();
  const write = deferredRead();
  const refresh = deferredRead();
  const retry = deferredRead();
  const methods: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    methods.push(init.method ?? "GET");
    if (init.method === "DELETE") {
      expect(url).toBe("/v1/recipes/recipes/abc/steps/mix");
      return write.pending;
    }
    if (methods.length === 1) return Response.json(steps);
    return methods.length === 3 ? refresh.pending : retry.pending;
  });

  await act(async () => {
    render(<RecipeSteps id="abc" />);
  });
  const [removedRow, retainedRow] = screen.getAllByRole("listitem");
  const remove = button("Supprimer l’étape 1");
  fireEvent.click(remove);
  expect(screen.getByRole("dialog").textContent).toContain("Mixer.");
  fireEvent.click(button("Annuler"));
  expect(methods).toEqual(["GET"]);
  fireEvent.click(remove);
  fireEvent.click(button("Supprimer"));
  screen.getByText("Opération en cours…");
  await act(async () => write.respond(new Response(null, { status: 204 })));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(remove);
  function expectSameRows() {
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(removedRow);
    expect(rows[1]).toBe(retainedRow);
  }
  expectSameRows();

  await advance(199);
  expect(screen.queryByText("Actualisation des étapes…")).toBeNull();
  await advance(1);
  expect(screen.getByRole("status").textContent).toBe(
    "Actualisation des étapes…",
  );
  await act(async () => refresh.respond(new Response(null, { status: 503 })));
  expect(screen.queryByText("Actualisation des étapes…")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe(
    "Impossible d’actualiser les étapes.",
  );
  function expectBlocked() {
    expectSameRows();
    for (const label of [
      "Ajouter une étape",
      "Modifier l’étape 2",
      "Supprimer l’étape 1",
      "Déplacer l’étape 1",
    ]) {
      const control = button(label);
      expect(control.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(control);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  }
  expectBlocked();
  fireEvent.click(button("Réessayer"));
  expect(screen.queryByRole("alert")).toBeNull();
  expectBlocked();
  remove.focus();
  await act(async () =>
    retry.respond(Response.json([{ ...steps[1], position: 1 }])),
  );
  expect(screen.getByRole("listitem")).toBe(retainedRow);
  expect((retainedRow as HTMLLIElement).value).toBe(1);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Préparation" }),
  );
  expect(button("Ajouter une étape").hasAttribute("aria-disabled")).toBe(false);
  expect(methods).toEqual(["GET", "DELETE", "GET", "GET"]);
});
