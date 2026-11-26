import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Catalogue } from "../../../../src/modules/recipes/Catalogue";
import { searchIngredients } from "../../../../src/modules/recipes/api/ingredients";
import { searchRecipes, type Recipe } from "../../../../src/modules/recipes/api/recipes";
import type { Page } from "../../../../src/core/search/contract";

vi.mock("../../../../src/modules/recipes/api/recipes", () => ({ searchRecipes: vi.fn() }));
vi.mock("../../../../src/modules/recipes/api/ingredients", () => ({ searchIngredients: vi.fn() }));
const recipes = vi.mocked(searchRecipes);
const ingredients = vi.mocked(searchIngredients);
const page = (names: string[], nextOffset: number | null = null): Page<Recipe> => ({
  items: names.map(name => ({ id: name, name, description: "" })),
  hasMore: nextOffset !== null, nextOffset, limit: 12, offset: 0,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((r, fail) => { resolve = r; reject = fail; });
  return { promise, resolve, reject };
}
beforeAll(() => {
  // jsdom lacks native modal dialog methods; Playwright checks native focus.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); vi.useRealTimers(); });

it("Given a pending catalogue, When I finish typing, Then only the debounced query can replace the cards", async () => {
  vi.useFakeTimers();
  const first = deferred<Page<Recipe>>();
  recipes.mockReturnValueOnce(first.promise).mockResolvedValueOnce(page(["Soupe"]));
  render(<Catalogue />);
  const input = screen.getByRole("textbox", { name: "Rechercher une recette" });
  fireEvent.change(input, { target: { value: "s" } });
  await act(() => vi.advanceTimersByTimeAsync(200));
  fireEvent.change(input, { target: { value: "soupe" } });
  await act(() => vi.advanceTimersByTimeAsync(249));
  expect(recipes).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(recipes.mock.lastCall?.[0].filter).toEqual({
    logicalOperator: "OR", children: ["name", "description"].map(attribute => ({
      attribute, filterOperator: "CONTAINS", value: "soupe",
    })),
  });
  await act(async () => first.resolve(page(["Tarte"])));
  screen.getByRole("link", { name: "Soupe" });
  expect(screen.queryByText("Tarte")).toBeNull();
});

it("Given a pending continuation, When I change sort and retry, Then older pages cannot replace or append to the current results", async () => {
  const oldMore = deferred<Page<Recipe>>();
  recipes.mockResolvedValueOnce(page(["Ancienne"], 37)).mockReturnValueOnce(oldMore.promise)
    .mockRejectedValueOnce(new Error()).mockResolvedValueOnce(page(["Nouvelle"], 26))
    .mockResolvedValueOnce(page(["Suite"]));
  render(<Catalogue />);
  await userEvent.click(await screen.findByRole("button", { name: "Plus de recettes" }));
  expect(recipes.mock.lastCall?.[1]).toBe(37);
  screen.getByText("Ancienne");
  await userEvent.selectOptions(screen.getByRole("combobox"), "descriptionDesc");
  screen.getByRole("alert");
  screen.getByRole("link", { name: "Ancienne" });
  await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(recipes.mock.lastCall?.slice(0, 2)).toEqual([
    expect.objectContaining({ sort: { attribute: "description", direction: "DESC" } }), 0,
  ]);
  await act(async () => oldMore.resolve(page(["Périmée"])));
  expect(screen.queryByText("Périmée")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Plus de recettes" }));
  expect(recipes.mock.lastCall?.[1]).toBe(26);
  screen.getByText("Nouvelle"); screen.getByText("Suite");
  expect(screen.queryByText("Ancienne")).toBeNull();
});

it("Given paginated suggestions, When I choose one, Then it is excluded from the picker and removable by keyboard", async () => {
  recipes.mockResolvedValue(page([]));
  ingredients.mockResolvedValueOnce(page(["Ail"], 14)).mockResolvedValueOnce(page(["Persil"]))
    .mockResolvedValueOnce(page(["Ail", "Persil"]));
  render(<Catalogue />);
  const add = screen.getByRole("button", { name: "+ Ingrédient" });
  await userEvent.click(add);
  await userEvent.click(await screen.findByRole("button", { name: "Plus d’ingrédients" }));
  expect(ingredients.mock.lastCall?.[1]).toBe(14);
  await userEvent.click(screen.getByRole("button", { name: "Persil" }));
  expect(recipes.mock.lastCall?.[0].filter).toEqual({ attribute: "ingredientName", filterOperator: "EQ", value: "Persil" });
  await userEvent.click(add);
  await screen.findByRole("button", { name: "Ail" });
  expect(screen.queryByRole("button", { name: "Persil" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
  add.focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retirer Persil" }));
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retirer Persil" })).toBeNull());
  expect(document.activeElement).toBe(add);
});

it.each(["catalogue", "picker"] as const)("Given a focused %s continuation, When it fails and I retry, Then focus moves from retry to the first appended item", async kind => {
  const more = deferred<Page<Recipe>>();
  const retry = deferred<Page<Recipe>>();
  recipes.mockResolvedValue(page([]));
  const api = kind === "picker" ? ingredients : recipes;
  api.mockResolvedValueOnce(page(["Première"], 18)).mockReturnValueOnce(more.promise).mockReturnValueOnce(retry.promise);
  render(<Catalogue />);
  if (kind === "picker") await userEvent.click(screen.getByRole("button", { name: "+ Ingrédient" }));
  const action = await screen.findByRole("button", { name: /^Plus de recettes|^Plus d’ingrédients/ });
  action.focus();
  await userEvent.keyboard("{Enter}");
  expect(document.activeElement).toBe(action);
  expect(action.getAttribute("aria-disabled")).toBe("true");
  await userEvent.keyboard("{Enter}");
  expect(api).toHaveBeenCalledTimes(2);
  await act(async () => more.reject(new Error()));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Réessayer" }));
  const role = kind === "picker" ? "button" : "link";
  expect(screen.getByRole(role, { name: "Première" }).hasAttribute("disabled")).toBe(false);
  await userEvent.keyboard("{Enter}");
  expect(api.mock.lastCall?.[1]).toBe(18);
  await act(async () => retry.resolve(page(["Deuxième", "Troisième"])));
  expect(document.activeElement).toBe(screen.getByRole(role, { name: "Deuxième" }));
});

it("Given pending pagination, When I tab away, Then new results do not steal focus", async () => {
  const more = deferred<Page<Recipe>>();
  recipes.mockResolvedValue(page([]));
  ingredients.mockResolvedValueOnce(page(["Ail"], 10)).mockReturnValueOnce(more.promise);
  render(<Catalogue />);
  await userEvent.click(screen.getByRole("button", { name: "+ Ingrédient" }));
  await userEvent.click(await screen.findByRole("button", { name: "Plus d’ingrédients" }));
  await userEvent.tab();
  const close = screen.getByRole("button", { name: "Fermer" });
  expect(document.activeElement).toBe(close);
  await act(async () => more.resolve(page(["Persil"])));
  expect(document.activeElement).toBe(close);
});

it("Given text and two ingredient chips, When I change to any and return to the catalogue, Then the combined query and controls are restored", async () => {
  const user = userEvent.setup();
  recipes.mockResolvedValue(page(["Soupe"]));
  ingredients.mockResolvedValue(page(["Ail", "Persil"]));
  const view = render(<Catalogue />);
  await user.type(screen.getByRole("textbox", { name: "Rechercher une recette" }), "soupe");
  for (const name of ["Ail", "Persil"]) {
    await user.click(screen.getByRole("button", { name: "+ Ingrédient" }));
    await user.click(await screen.findByRole("button", { name }));
  }
  expect((screen.getByRole("radio", { name: "Tous" }) as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("radio", { name: "Au moins un" }));
  const filter = {
    logicalOperator: "AND", children: [
      { logicalOperator: "OR", children: ["name", "description"].map(attribute =>
        ({ attribute, filterOperator: "CONTAINS", value: "soupe" })) },
      { logicalOperator: "OR", children: ["Ail", "Persil"].map(value =>
        ({ attribute: "ingredientName", filterOperator: "EQ", value })) },
    ],
  };
  await waitFor(() => expect(recipes.mock.lastCall?.[0].filter).toEqual(filter));
  view.unmount();
  render(<Catalogue />);
  await screen.findByRole("link", { name: "Soupe" });
  screen.getByDisplayValue("soupe");
  screen.getByRole("button", { name: "Retirer Ail" });
  screen.getByRole("button", { name: "Retirer Persil" });
  expect((screen.getByRole("radio", { name: "Au moins un" }) as HTMLInputElement).checked).toBe(true);
  expect(recipes.mock.lastCall?.[0].filter).toEqual(filter);
});

it("Given a failed continuation, When I choose a loaded suggestion and start another search, Then only current suggestions are available", async () => {
  const replacement = deferred<Page<Recipe>>();
  recipes.mockResolvedValue(page([]));
  ingredients.mockResolvedValueOnce(page(["Ail"], 10)).mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce(page(["Persil"])).mockReturnValueOnce(replacement.promise);
  render(<Catalogue />);
  const add = screen.getByRole("button", { name: "+ Ingrédient" });
  await userEvent.click(add);
  await userEvent.click(await screen.findByRole("button", { name: "Plus d’ingrédients" }));
  screen.getByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Ail" }));
  screen.getByRole("button", { name: "Retirer Ail" });
  await userEvent.click(add);
  await screen.findByRole("button", { name: "Persil" });
  fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un ingrédient" }), { target: { value: "menthe" } });
  const stale = screen.getByRole("button", { name: "Persil" });
  expect(stale.hasAttribute("disabled")).toBe(true);
  await userEvent.click(stale);
  screen.getByRole("dialog");
  await act(async () => replacement.reject(new Error()));
  screen.getByRole("alert");
  expect(screen.queryByRole("button", { name: "Persil" })).toBeNull();
});
