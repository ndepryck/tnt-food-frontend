import { request, requestJson } from "../../core/http";
import type { Page, Search } from "../../core/search/contract";
import { searchEndpoint } from "../../core/search/searchEndpoint";

export interface Recipe { id: string; name: string; description: string }

const recipes = "/v1/recipes/recipes";

export type CreateRecipeRequest = Pick<Recipe, "name" | "description">;
export type UpdateRecipeRequest = Partial<CreateRecipeRequest>;

function jsonWrite(method: "POST" | "PATCH", body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
export async function createRecipe(fields: CreateRecipeRequest) {
  const [created] = await requestJson<Recipe[]>(recipes, jsonWrite("POST", [fields]));
  if (!created?.id) throw new Error("Missing created recipe");
  return created;
}
export function updateRecipe(id: string, fields: UpdateRecipeRequest) {
  return requestJson<Recipe>(`${recipes}/${encodeURIComponent(id)}`, jsonWrite("PATCH", fields));
}
export async function deleteRecipe(id: string): Promise<void> {
  await request(`${recipes}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface Ingredient { id: string; name: string }
export type RecipeSearch = Search<"name" | "description" | "ingredientName", "id", "name" | "description">;
export type IngredientSearch = Search<"name", "id", "name">;

export const searchRecipes = searchEndpoint<Recipe, RecipeSearch>(`${recipes}/search`);
export const searchIngredients = searchEndpoint<Ingredient, IngredientSearch>("/v1/recipes/ingredients/search");

export function readRecipe(id: string, signal: AbortSignal) {
  return requestJson<Recipe>(`${recipes}/${encodeURIComponent(id)}`, { signal });
}

export interface RecipeIngredientResponse { ingredientId: string; ingredientName: string; quantity: string }
export interface RecipeStepResponse { id: string; recipeId: string; position: number; description: string }

export function readRecipeIngredients(id: string, offset: number, signal: AbortSignal) {
  return requestJson<Page<RecipeIngredientResponse>>(`${recipes}/${encodeURIComponent(id)}/ingredients?limit=20&offset=${offset}`, { signal });
}

export async function readLinkedIngredients(id: string, signal: AbortSignal) {
  const linked: Ingredient[] = [];
  let offset: number | null = 0;
  do {
    const page: Page<RecipeIngredientResponse> = await readRecipeIngredients(id, offset, signal);
    linked.push(...page.items.map(row => ({ id: row.ingredientId, name: row.ingredientName })));
    offset = page.hasMore ? page.nextOffset : null;
  } while (offset !== null);
  return linked;
}

const memberships = (id: string) => `${recipes}/${encodeURIComponent(id)}/ingredients`;
export function addRecipeIngredient(id: string, ingredientId: string, quantity: string) {
  return requestJson<RecipeIngredientResponse[]>(memberships(id), jsonWrite("POST", [{ ingredientId, quantity }]));
}
export function updateRecipeIngredient(id: string, ingredientId: string, quantity: string) {
  return requestJson<RecipeIngredientResponse>(`${memberships(id)}/${encodeURIComponent(ingredientId)}`, jsonWrite("PATCH", { quantity }));
}
export async function removeRecipeIngredient(id: string, ingredientId: string) {
  await request(`${memberships(id)}/${encodeURIComponent(ingredientId)}`, { method: "DELETE" });
}

export async function readSteps(id: string, signal: AbortSignal) {
  const steps = await requestJson<RecipeStepResponse[]>(`${recipes}/${encodeURIComponent(id)}/steps`, { signal });
  return steps.sort((a, b) => a.position - b.position);
}
