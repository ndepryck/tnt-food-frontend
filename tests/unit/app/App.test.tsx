import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../../../src/app/App";

const recipe = { id: "2beee154-db0a-4d14-93db-e2bb3ae94b18", name: "Soupe", description: "Aux légumes." };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

test("Given the catalogue request is pending, When I open the root, Then I see loading followed by a recipe link", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", () => new Promise<Response>(resolve => { finish = resolve; }));
  render(<App />);
  expect(screen.getByRole("status").textContent).toContain("Chargement");
  finish(Response.json({ items: [recipe] }));
  expect((await screen.findByRole("link", { name: recipe.name })).getAttribute("href")).toBe(`/recipes/${recipe.id}`);
});

test("Given the catalogue is offline, When I retry after recovery, Then I see the empty catalogue", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(Response.json({ items: [] })));
  history.replaceState(null, "", "/recipes");
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger les recettes");
  await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByText("Aucune recette.");
});

test("Given a recipe request failed, When I retry, Then the recipe title and description appear", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/ingredients?")) return Response.json({ items: [], hasMore: false });
    if (url.endsWith("/steps")) return Response.json([]);
    return attempts++ ? Response.json(recipe) : new Response(null, { status: 503 });
  });
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
  await screen.findByRole("heading", { name: recipe.name });
  expect(screen.getByRole("link", { name: "← Recettes" }).getAttribute("href")).toBe("/recipes");
  screen.getByText(recipe.description);
});

test("Given a deleted recipe, When I open its URL, Then I see a missing-recipe heading and a catalogue link", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  await screen.findByRole("heading", { name: "Recette introuvable" });
  expect(document.activeElement).toBe(document.body);
  expect(screen.getByRole("link", { name: "Retour au catalogue" }).getAttribute("href")).toBe("/recipes");
  expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
});

test.each([false, true])("Given a pending recipe retry, When it returns 404 (focus moved: %s), Then focus remains with the reader", async moved => {
  let attempts = 0;
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/ingredients?")) return Response.json({ items: [], hasMore: false });
    if (url.endsWith("/steps")) return Response.json([]);
    return attempts++ ? new Promise<Response>(resolve => { finish = resolve; }) : new Response(null, { status: 503 });
  });
  history.replaceState(null, "", `/recipes/${recipe.id}`);
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Recette" }));
  const navLink = screen.getByRole("link", { name: "Recettes" });
  if (moved) navLink.focus();
  finish(new Response(null, { status: 404 }));
  const missing = await screen.findByRole("heading", { name: "Recette introuvable" });
  expect(document.activeElement).toBe(moved ? navLink : missing);
});
