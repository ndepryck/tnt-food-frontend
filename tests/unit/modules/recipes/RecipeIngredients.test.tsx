import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RecipeIngredients } from "../../../../src/modules/recipes/RecipeIngredients";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const row = (name: string, quantity = "1") => ({ ingredientId: name, ingredientName: name, quantity });
const page = (items: unknown[], nextOffset: number | null = null) => Response.json({ items, nextOffset, hasMore: nextOffset !== null });
const add = () => screen.getByRole("button", { name: "Ajouter un ingrédient" });

test("Given linked ingredients on unseen pages, When I retry their lookup, Then the picker offers only unlinked ingredients", async () => {
  let fail = true;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/search")) return page(["Sel", "Poivre", "Riz"].map(name => ({ id: name, name })));
    if (url.endsWith("offset=8")) {
      if (fail) { fail = false; return new Response(null, { status: 500 }); }
      return page([row("Poivre")]);
    }
    return page([row("Sel")], 8);
  });
  render(<RecipeIngredients id="abc" validation={0} />);
  await screen.findByText("Sel");
  await userEvent.click(add());
  const picker = within(screen.getByRole("dialog"));
  await picker.findByRole("alert");
  expect(picker.queryByLabelText("Rechercher un ingrédient")).toBeNull();
  await userEvent.click(picker.getByRole("button", { name: "Réessayer" }));
  await picker.findByRole("button", { name: "Riz" });
  expect(picker.queryByRole("button", { name: "Sel" })).toBeNull();
  expect(picker.queryByRole("button", { name: "Poivre" })).toBeNull();
});

test("Given a blank quantity then a duplicate link, When I choose another ingredient, Then the exact quantity survives and memberships refresh", async () => {
  const writes: unknown[] = [];
  const quantity = "  1 c. à café  ";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/search")) return page(["Sel", "Riz"].map(name => ({ id: name, name })));
    if (init.method === "POST") {
      writes.push(JSON.parse(String(init.body)));
      return writes.length === 1 ? new Response(null, { status: 409 }) : Response.json([row("Riz", quantity)]);
    }
    return page(writes.length === 2 ? [row("Riz", quantity)] : writes.length === 1 ? [row("Sel")] : []);
  });
  render(<RecipeIngredients id="abc" validation={0} />);
  await userEvent.click(add());
  await userEvent.click(await screen.findByRole("button", { name: "Sel" }));
  const input = screen.getByLabelText("Quantité") as HTMLInputElement;
  await userEvent.type(input, "   ");
  const save = screen.getByRole("button", { name: "Ajouter" });
  await userEvent.click(save);
  expect(writes).toEqual([]);
  expect(document.activeElement).toBe(input);
  await userEvent.clear(input);
  await userEvent.type(input, quantity);
  await userEvent.click(save);
  expect((await screen.findByRole("alert")).textContent).toContain("déjà associé");
  await userEvent.click(screen.getByRole("button", { name: "Changer d’ingrédient" }));
  await userEvent.click(await screen.findByRole("button", { name: "Riz" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Changer d’ingrédient" }));
  expect(input.value).toBe(quantity);
  await userEvent.click(save);
  expect((await screen.findByRole("listitem")).textContent).toContain(quantity);
  expect(writes).toEqual([[{ ingredientId: "Sel", quantity }], [{ ingredientId: "Riz", quantity }]]);
});

test("Given a saved quantity and a stalled refresh, When I reopen the editor, Then the row and form show the PATCH response even if the refresh fails", async () => {
  let finish!: (response: Response) => void;
  let saved = false;
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    if (init.method === "PATCH") { saved = true; return Response.json(row("Riz", "300 g")); }
    if (saved) return new Promise<Response>(resolve => { finish = resolve; });
    return page([row("Riz", "250 g")]);
  });
  render(<RecipeIngredients id="abc" validation={0} />);
  const edit = await screen.findByRole("button", { name: "Modifier la quantité : Riz" });
  await userEvent.click(edit);
  await userEvent.clear(screen.getByLabelText("Quantité"));
  await userEvent.type(screen.getByLabelText("Quantité"), "300 grammes");
  await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await screen.findByText("Chargement des ingrédients…");
  screen.getByText("300 g");
  await userEvent.click(edit);
  expect((screen.getByLabelText("Quantité") as HTMLInputElement).value).toBe("300 g");
  finish(new Response(null, { status: 503 }));
  await screen.findByText("Impossible de charger les ingrédients.");
  await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
  screen.getByText("300 g");
});

test("Given a linked ingredient, When I confirm removal, Then the link alone is deleted and focus returns to the add control", async () => {
  const deletes: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (init.method === "DELETE") { deletes.push(url); return new Response(null, { status: 204 }); }
    return page(deletes.length ? [] : [row("Riz")]);
  });
  render(<RecipeIngredients id="abc" validation={0} />);
  await userEvent.click(await screen.findByRole("button", { name: "Retirer de la recette : Riz" }));
  await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
  await screen.findByText("Aucun ingrédient.");
  expect(deletes).toEqual(["/v1/recipes/recipes/abc/ingredients/Riz"]);
  expect(document.activeElement).toBe(add());
});

test("Given a failed quantity edit, When I retry and then cancel removal, Then only the quantity changes and the ingredient remains linked", async () => {
  const writes: [string, string | undefined, unknown][] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (init.method === "PATCH") {
      writes.push([url, init.method, JSON.parse(String(init.body))]);
      return writes.length === 1 ? new Response(null, { status: 503 }) : Response.json(row("Riz", "300 g"));
    }
    return page([row("Riz", writes.length === 2 ? "300 g" : "250 g")]);
  });
  render(<RecipeIngredients id="abc" validation={0} />);
  await userEvent.click(await screen.findByRole("button", { name: "Modifier la quantité : Riz" }));
  const input = screen.getByLabelText("Quantité") as HTMLInputElement;
  expect(input.value).toBe("250 g");
  await userEvent.clear(input);
  await userEvent.type(input, "300 g");
  const save = screen.getByRole("button", { name: "Enregistrer" });
  await userEvent.click(save);
  await screen.findByRole("alert");
  expect(input.value).toBe("300 g");
  await userEvent.click(save);
  await screen.findByText("300 g");
  expect(writes[1]).toEqual(["/v1/recipes/recipes/abc/ingredients/Riz", "PATCH", { quantity: "300 g" }]);
  await userEvent.click(screen.getByRole("button", { name: "Retirer de la recette : Riz" }));
  await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  screen.getByText("300 g");
});
