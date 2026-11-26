import { afterEach, expect, it, vi } from "vitest";
import { recipeHistory } from "../../../../../src/modules/recipes/navigation/recipeHistory";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it.each([
  ["a", "changed"],
  ["b", "unknown"],
] as const)(
  "Given a frozen detail for %s, When another document saves recipe a, Then the detail's invalidation is %s",
  (id, affected) => {
    const detail = recipeHistory();
    const catalogue = recipeHistory();
    catalogue.written("A");
    expect(detail.restore(id)).toBe(affected);
  },
);

it("Given unavailable revision storage, When Back restores the origin of a successful navigating write, Then the locked dialog is discarded", () => {
  const origin = recipeHistory();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  origin.written("a");
  origin.leavingAfterWrite();
  recipeHistory();
  expect(origin.restore()).toBe("changed");
});

it("Given a writer denied all storage, When Back crosses another healthy entry, Then an older catalogue cannot trust the skipped write", () => {
  function entry() {
    let state: unknown;
    return {
      getState: () => structuredClone(state),
      save: (next: unknown) => {
        state = structuredClone(next);
      },
    };
  }
  const navigation = {
    currentEntry: entry(),
    activation: { from: entry() },
    updateCurrentEntry({ state }: { state: unknown }) {
      this.currentEntry.save(state);
    },
  };
  const first = navigation.currentEntry;
  function visit(next = entry()) {
    navigation.activation.from = navigation.currentEntry;
    navigation.currentEntry = next;
  }
  vi.stubGlobal("navigation", navigation);
  const catalogue = recipeHistory();
  visit();
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("denied");
    });
  }
  const writer = recipeHistory();
  writer.written("a");
  vi.restoreAllMocks();
  visit();
  recipeHistory();
  visit(first);
  expect(catalogue.restore()).toBe("changed");
});
