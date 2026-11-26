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
import { RecipeSteps } from "../../../../src/modules/recipes/RecipeSteps";

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
  vi.unstubAllGlobals();
});
const steps = [
  { id: "mix", recipeId: "abc", position: 1, description: "Mixer." },
  { id: "serve", recipeId: "abc", position: 2, description: "Servir." },
];
const button = (name: string) => screen.getByRole("button", { name });

// jsdom has neither pointer capture nor layout; supply the hit row explicitly.
function touch(
  handle: HTMLElement,
  type: string,
  hit?: Element,
  clientY = 200,
) {
  handle.setPointerCapture = vi.fn();
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
    return Response.json(
      writes.length === 2
        ? [
            { ...steps[1], position: 1 },
            { ...steps[0], position: 2 },
          ]
        : steps,
    );
  });
  render(
    <>
      <button type="button">Autre contrôle</button>
      <RecipeSteps id="abc" />
    </>,
  );
  const [, last] = await screen.findAllByRole("listitem");
  const handle = button("Déplacer l’étape 1");
  touch(handle, "pointerdown");
  touch(handle, "pointerup", last);
  await screen.findByRole("alert");
  await userEvent.click(button("Réessayer"));
  for (const label of [
    "Ajouter une étape",
    "Modifier l’étape 2",
    "Supprimer l’étape 1",
  ])
    await userEvent.click(button(label));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect((handle as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(button("Autre contrôle"));
  finish(Response.json({ ...steps[0], position: 2 }));
  await screen.findByText("Servir.", {
    selector: "li[value='1'] .step-instruction span",
  });
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

test("Given a confirmed delete and failed refresh, When I retry, Then I see compacted positions without a second delete", async () => {
  const writes: string[] = [];
  let failRead = true;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (init.method === "DELETE") {
      writes.push(url);
      return new Response(null, { status: 204 });
    }
    if (!writes.length) return Response.json(steps);
    if (failRead) {
      failRead = false;
      return new Response(null, { status: 503 });
    }
    return Response.json([{ ...steps[1], position: 1 }]);
  });
  render(<RecipeSteps id="abc" />);
  const remove = await screen.findByRole("button", {
    name: "Supprimer l’étape 1",
  });
  await userEvent.click(remove);
  expect(screen.getByRole("dialog").textContent).toContain("Mixer.");
  await userEvent.click(button("Annuler"));
  expect(writes).toEqual([]);
  await userEvent.click(remove);
  await userEvent.click(button("Supprimer"));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "charger les étapes",
  );
  expect(
    screen.queryByRole("button", { name: "Ajouter une étape" }),
  ).toBeNull();
  await userEvent.click(button("Réessayer"));
  expect(((await screen.findByRole("listitem")) as HTMLLIElement).value).toBe(
    1,
  );
  screen.getByText("Servir.");
  expect(writes).toEqual(["/v1/recipes/recipes/abc/steps/mix"]);
});
