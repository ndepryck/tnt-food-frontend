import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  createRecipe,
  deleteRecipe,
  searchRecipes,
  updateRecipe,
} from "../../../../src/modules/recipes/api/recipes";
import { Catalogue } from "../../../../src/modules/recipes/Catalogue";
import { recipeVisits } from "../../../../src/modules/recipes/recipeHistory";

vi.mock("../../../../src/modules/recipes/api/recipes", async (original) => ({
  ...(await original<
    typeof import("../../../../src/modules/recipes/api/recipes")
  >()),
  searchRecipes: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  createRecipe: vi.fn(),
}));
const recipe = { id: "1", name: "Soupe", description: "Aux carottes" };
const page = {
  items: [recipe],
  limit: 12,
  offset: 0,
  nextOffset: null,
  hasMore: false,
};
const dialog = () => within(screen.getByRole("dialog"));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => vi.mocked(searchRecipes).mockResolvedValue(page));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("Given an empty create dialog, When I navigate and submit blank fields, Then focus stays inside until Escape restores the opener", async () => {
  render(<Catalogue />);
  const opener = screen.getByRole("button", { name: "+ Nouvelle recette" });
  await userEvent.click(opener);
  const name = dialog().getByRole("textbox", { name: "Nom" });
  expect(document.activeElement).toBe(name);
  await userEvent.tab({ shift: true });
  await userEvent.tab({ shift: true });
  expect(document.activeElement).toBe(
    dialog().getByRole("button", { name: "Créer" }),
  );
  await userEvent.keyboard("{Enter}");
  expect(dialog().getByRole("alert").textContent).toContain("Nom");
  await userEvent.type(name, "Tarte");
  await userEvent.type(dialog().getByLabelText("Description"), "  ");
  await userEvent.click(dialog().getByRole("button", { name: "Créer" }));
  expect(dialog().getByRole("alert").textContent).toContain("Description");
  expect(createRecipe).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(opener);
});

it("Given a pending edit, When I submit twice and the write fails, Then I can retry once without losing input", async () => {
  const written = vi.spyOn(recipeVisits, "written");
  let fail!: (e: Error) => void;
  const updated = { ...recipe, name: "Bouillon" };
  vi.mocked(updateRecipe)
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    )
    .mockResolvedValueOnce(updated);
  vi.mocked(searchRecipes)
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce({ ...page, items: [updated] });
  render(<Catalogue />);
  const opener = await screen.findByRole("button", {
    name: "Modifier la recette : Soupe",
  });
  await userEvent.click(opener);
  const name = dialog().getByRole("textbox", {
    name: "Nom",
  }) as HTMLInputElement;
  expect(name.value).toBe(recipe.name);
  await userEvent.clear(name);
  await userEvent.type(name, updated.name);
  const save = dialog().getByRole("button", { name: "Enregistrer" });
  await userEvent.click(save);
  await userEvent.keyboard("{Escape}");
  await userEvent.click(dialog().getByRole("button", { name: "Annuler" }));
  await userEvent.click(save);
  expect(updateRecipe).toHaveBeenCalledTimes(1);
  expect(updateRecipe).toHaveBeenCalledWith(recipe.id, { name: updated.name });
  await act(async () => fail(new Error()));
  expect(written).not.toHaveBeenCalled();
  expect(dialog().getByRole("alert").textContent).toContain(
    "Impossible d’enregistrer",
  );
  expect(name.value).toBe(updated.name);
  expect(
    (dialog().getByLabelText("Description") as HTMLTextAreaElement).value,
  ).toBe(recipe.description);
  await userEvent.click(save);
  await screen.findByRole("link", { name: updated.name });
  expect(written).toHaveBeenCalledWith(recipe.id);
  expect(document.activeElement).toBe(opener);
  expect(searchRecipes).toHaveBeenCalledTimes(2);
});

it("Given a named confirmation, When I cancel then confirm deletion, Then only the confirmed card is removed and search gets focus", async () => {
  vi.mocked(searchRecipes)
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce({ ...page, items: [] });
  render(<Catalogue />);
  const opener = await screen.findByRole("button", {
    name: "Supprimer la recette : Soupe",
  });
  await userEvent.click(opener);
  dialog().getByText(/« Soupe »/);
  expect(document.activeElement).toBe(
    dialog().getByRole("button", { name: "Annuler" }),
  );
  await userEvent.keyboard("{Enter}");
  expect(deleteRecipe).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(opener);
  await userEvent.click(opener);
  await userEvent.click(dialog().getByRole("button", { name: "Supprimer" }));
  await screen.findByText("Aucune recette.");
  expect(deleteRecipe).toHaveBeenCalledWith(recipe.id);
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Rechercher une recette" }),
  );
});

it("Given a reverted edit, When I save, Then the dialog closes without a PATCH or refresh", async () => {
  const written = vi.spyOn(recipeVisits, "written");
  render(<Catalogue />);
  const opener = await screen.findByRole("button", {
    name: "Modifier la recette : Soupe",
  });
  await userEvent.click(opener);
  const name = dialog().getByLabelText("Nom");
  await userEvent.type(name, "s{Backspace}");
  await userEvent.click(dialog().getByRole("button", { name: "Enregistrer" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(updateRecipe).not.toHaveBeenCalled();
  expect(written).not.toHaveBeenCalled();
  expect(searchRecipes).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  "Given a slow refresh (focus moved: %s), When a saved card leaves the results, Then the editor has closed and focus is not lost or stolen",
  async (moved) => {
    let finish!: (page: typeof empty) => void;
    const empty = { ...page, items: [] };
    vi.mocked(searchRecipes)
      .mockResolvedValueOnce(page)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    vi.mocked(updateRecipe).mockResolvedValueOnce({
      ...recipe,
      description: "Au persil",
    });
    render(<Catalogue />);
    const opener = await screen.findByRole("button", {
      name: "Modifier la recette : Soupe",
    });
    await userEvent.click(opener);
    const description = dialog().getByLabelText("Description");
    await userEvent.clear(description);
    await userEvent.type(description, "Au persil");
    await userEvent.click(
      dialog().getByRole("button", { name: "Enregistrer" }),
    );
    expect(updateRecipe).toHaveBeenCalledWith(recipe.id, {
      description: "Au persil",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    screen.getByRole("status");
    expect(document.activeElement).toBe(opener);
    const other = screen.getByRole("combobox");
    if (moved) other.focus();
    await act(async () => finish(empty));
    expect(screen.queryByRole("link", { name: "Soupe" })).toBeNull();
    expect(document.activeElement).toBe(
      moved
        ? other
        : screen.getByRole("textbox", { name: "Rechercher une recette" }),
    );
  },
);

it("Given a stalled refresh, When deletion succeeds, Then the card and its confirmation disappear immediately", async () => {
  vi.mocked(searchRecipes)
    .mockResolvedValueOnce(page)
    .mockReturnValueOnce(new Promise(() => {}));
  render(<Catalogue />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Supprimer la recette : Soupe" }),
  );
  await userEvent.click(dialog().getByRole("button", { name: "Supprimer" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("link", { name: "Soupe" })).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Rechercher une recette" }),
  );
  screen.getByRole("status");
});
