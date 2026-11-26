import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../../../src/app/App";
import {
  recipeHistory,
  recipeVisits,
} from "../../../src/modules/recipes/navigation/recipeHistory";

const recipe = {
  id: "2beee154-db0a-4d14-93db-e2bb3ae94b18",
  name: "Soupe",
  description: "Aux légumes.",
};

// Each scenario starts a new tab; unlike a real navigation Vitest retains
// the module instance after the previous scenario's storage was cleared.
beforeEach(() => {
  recipeVisits.restore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

test("Given the catalogue request is pending, When I open the root, Then I see loading followed by a recipe link", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  render(<App />);
  expect(screen.getByRole("status").textContent).toContain("Chargement");
  finish(Response.json({ items: [recipe] }));
  expect(
    (await screen.findByRole("link", { name: recipe.name })).getAttribute(
      "href",
    ),
  ).toBe(`/recipes/${recipe.id}`);
});

test("Given the catalogue is offline, When I retry after recovery, Then I see the empty catalogue", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json({ items: [] })),
  );
  history.replaceState(null, "", "/recipes");
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Impossible de charger les recettes",
  );
  await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByText("Aucune recette.");
});

function back() {
  act(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
}

test("Given a focused second-page recipe, When I go Back after reading its detail, Then pagination, focus and cards are preserved without a request", async () => {
  // Both entries hand on the same revision via the Navigation API.
  let state: unknown;
  const entry = { getState: () => structuredClone(state) };
  vi.stubGlobal("navigation", {
    currentEntry: entry,
    activation: { from: entry },
    updateCurrentEntry: (options: { state: unknown }) => {
      state = structuredClone(options.state);
    },
  });
  recipeVisits.restore();
  const second = { ...recipe, id: "second", name: "Salade" };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ items: [recipe], hasMore: true, nextOffset: 12 }),
    )
    .mockResolvedValueOnce(
      Response.json({ items: [second], hasMore: false, nextOffset: null }),
    );
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Plus de recettes" }),
  );
  const link = await screen.findByRole("link", { name: second.name });
  link.focus();
  recipeHistory(); // Independent detail document, same tab.
  back();
  expect(document.activeElement).toBe(link);
  expect(screen.getByRole("link", { name: second.name })).toBe(link);
  expect(fetch).toHaveBeenCalledTimes(2);
});

function denyStorage() {
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("denied");
    });
  }
}

test("Given an unchanged storage revision, When Back follows a deletion by a storage-denied writer, Then the catalogue verifies and removes the deleted row", async () => {
  vi.stubGlobal("navigation", undefined);
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [recipe] }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
  );
  render(<App />);
  const link = await screen.findByRole("link", { name: recipe.name });
  link.focus();
  denyStorage();
  recipeHistory().written(recipe.id);
  vi.restoreAllMocks(); // Only the writer was denied.
  back();
  expect(document.activeElement).toBe(link);
  finish(Response.json({ items: [] }));
  await screen.findByText("Aucune recette.");
  expect(screen.queryByRole("link", { name: recipe.name })).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Rechercher une recette" }),
  );
});

test("Given two storage-denied documents, When I return without writing and verification fails on page two, Then both pages, controls and focus survive and retry rebuilds the chain", async () => {
  vi.stubGlobal("navigation", undefined);
  denyStorage();
  recipeVisits.restore();
  const second = { ...recipe, id: "second", name: "Salade" };
  let failPageTwo = false;
  const offsets: number[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { offset } = JSON.parse(String(init.body));
    offsets.push(offset);
    if (offset && failPageTwo) return new Response(null, { status: 503 });
    return Response.json(
      offset
        ? { items: [second], hasMore: false }
        : { items: [recipe], hasMore: true, nextOffset: 37 },
    );
  });
  render(<App />);
  const sort = screen.getByRole("combobox") as HTMLSelectElement;
  await userEvent.selectOptions(sort, "nameDesc");
  await userEvent.click(
    await screen.findByRole("button", { name: "Plus de recettes" }),
  );
  const link = await screen.findByRole("link", { name: second.name });
  link.focus();
  recipeHistory(); // Read-only visit.
  offsets.length = 0;
  failPageTwo = true;
  back();
  await screen.findByRole("alert");
  expect(offsets).toEqual([0, 37]);
  expect(sort.value).toBe("nameDesc");
  expect(screen.getByRole("link", { name: recipe.name })).toBeTruthy();
  expect(document.activeElement).toBe(link);
  failPageTwo = false;
  await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByRole("link", { name: second.name })).toBe(link);
  expect(offsets).toEqual([0, 37, 0, 37]);
  link.focus();
  back();
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""));
  expect(offsets.slice(4)).toEqual([0, 37]);
  expect(document.activeElement).toBe(link);
  expect(screen.getByRole("combobox")).toBe(sort);
});

test("Given an unverifiable restored detail, When the backend is offline then confirms deletion, Then I can read the cached summary until retry shows the missing recipe", async () => {
  vi.stubGlobal("navigation", undefined);
  const responses = [
    Response.json(recipe),
    new Response(null, { status: 503 }),
    new Response(null, { status: 404 }),
  ];
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/ingredients?"))
      return Response.json({ items: [], hasMore: false });
    if (url.endsWith("/steps")) return Response.json([]);
    return responses.shift();
  });
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  const heading = await screen.findByRole("heading", { name: recipe.name });
  heading.focus();
  back();
  const retry = await screen.findByRole("button", { name: "Réessayer" });
  expect(document.activeElement).toBe(heading);
  screen.getByText(recipe.description);
  await userEvent.click(retry);
  await screen.findByRole("heading", { name: "Recette introuvable" });
  expect(screen.queryByText(recipe.description)).toBeNull();
});

test("Given a frozen catalogue, When Back restores it after deletion, Then stale cards are cleared before revalidation completes", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [recipe] }))
      .mockImplementationOnce(() => new Promise(() => {})),
  );
  render(<App />);
  await screen.findByRole("link", { name: recipe.name });
  const detail = recipeHistory();
  detail.written(recipe.id);
  back();
  expect(screen.queryByRole("link", { name: recipe.name })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Chargement");
});

test("Given a recipe request failed, When I retry, Then the recipe title and description appear", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/ingredients?"))
      return Response.json({ items: [], hasMore: false });
    if (url.endsWith("/steps")) return Response.json([]);
    return attempts++
      ? Response.json(recipe)
      : new Response(null, { status: 503 });
  });
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Réessayer" }),
  );
  await screen.findByRole("heading", { name: recipe.name });
  expect(
    screen.getByRole("link", { name: "← Recettes" }).getAttribute("href"),
  ).toBe("/recipes");
  screen.getByText(recipe.description);
});

test("Given a deleted recipe, When I open its URL, Then I see a missing-recipe heading and a catalogue link", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
  );
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  await screen.findByRole("heading", { name: "Recette introuvable" });
  expect(document.activeElement).toBe(document.body);
  expect(
    screen
      .getByRole("link", { name: "Retour au catalogue" })
      .getAttribute("href"),
  ).toBe("/recipes");
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
});

test.each([false, true])(
  "Given a pending recipe retry, When it returns 404 (focus moved: %s), Then focus remains with the reader",
  async (moved) => {
    let attempts = 0;
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/ingredients?"))
        return Response.json({ items: [], hasMore: false });
      if (url.endsWith("/steps")) return Response.json([]);
      return attempts++
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : new Response(null, { status: 503 });
    });
    history.replaceState(null, "", `/recipes/${recipe.id}`);
    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Réessayer" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Recette" }),
    );
    const navLink = screen.getByRole("link", { name: "Recettes" });
    if (moved) navLink.focus();
    finish(new Response(null, { status: 404 }));
    const missing = await screen.findByRole("heading", {
      name: "Recette introuvable",
    });
    expect(document.activeElement).toBe(moved ? navLink : missing);
  },
);
