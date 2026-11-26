import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { RecipeDetail } from "../../../../src/modules/recipes/RecipeDetail";

const recipe = { id: "soupe", name: "Soupe", description: "Aux légumes." };
const row = (name: string, quantity: string) => ({ ingredientId: name, ingredientName: name, quantity });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("Given steps arrive out of order, When I open the recipe, Then preparation follows their numeric positions", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/steps")) return Response.json([
      { id: "serve", recipeId: recipe.id, position: 10, description: "Servir." },
      { id: "mix", recipeId: recipe.id, position: 2, description: "Mélanger." },
    ]);
    if (url.includes("/ingredients?")) return Response.json({ items: [], hasMore: false });
    return Response.json(recipe);
  });
  render(<RecipeDetail id={recipe.id} />);
  const preparation = within(screen.getByRole("region", { name: "Préparation" }));
  const rows = await preparation.findAllByRole("listitem");
  expect(rows.map(row => row.textContent)).toEqual(["2.Mélanger.", "10.Servir."]);
});

test("Given the next ingredient page fails, When I retry it by keyboard, Then the same offset loads and focus reaches the appended row", async () => {
  const offsets: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/steps")) return Response.json([{ id: "step", position: 1, description: "Mélanger." }]);
    if (!url.includes("/ingredients?")) return Response.json(recipe);
    offsets.push(new URL(url, "https://example.test").searchParams.get("offset")!);
    if (offsets.length === 2) return new Response(null, { status: 503 });
    return Response.json(offsets.length === 1
      ? { items: [row("Lentilles", "250 g")], hasMore: true, nextOffset: 7 }
      : { items: [row("Sel", "1 c. à café")], hasMore: false, nextOffset: null });
  });
  render(<RecipeDetail id={recipe.id} />);
  const more = await screen.findByRole("button", { name: "Plus d’ingrédients" });
  more.focus();
  await userEvent.keyboard("{Enter}");
  await screen.findByText("Impossible de charger les ingrédients.");
  screen.getByText("250 g");
  screen.getByText("Mélanger.");
  screen.getByText(recipe.description);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Réessayer" }));
  await userEvent.keyboard("{Enter}");
  const appended = (await screen.findByText("Sel")).closest("li");
  expect(appended?.textContent).toContain("1 c. à café");
  await waitFor(() => expect(document.activeElement).toBe(appended));
  expect(offsets).toEqual(["0", "7", "7"]);
});

test("Given the recipe is pending and steps failed, When I retry preparation, Then both empty sections remain independent of the recipe read", async () => {
  let attempts = 0;
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/steps")) return attempts++ ? Response.json([]) : new Response(null, { status: 500 });
    if (url.includes("/ingredients?")) return Response.json({ items: [], hasMore: false });
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  render(<RecipeDetail id={recipe.id} />);
  await screen.findByText("Aucun ingrédient.");
  const section = within(screen.getByRole("region", { name: "Préparation" }));
  expect((await section.findByRole("alert")).textContent).toContain("étapes");
  await userEvent.click(section.getByRole("button", { name: "Réessayer" }));
  await section.findByText("Aucune étape.");
  expect(document.activeElement).toBe(section.getByRole("heading"));
  screen.getByText("Chargement de la recette…");
  finish(Response.json(recipe));
  await screen.findByText(recipe.description);
});
