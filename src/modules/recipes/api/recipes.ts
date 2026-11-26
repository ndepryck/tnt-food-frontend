import { jsonWrite, request, requestJson } from "../../../core/http";
import type { Search } from "../../../core/search/contract";
import { searchEndpoint } from "../../../core/search/searchEndpoint";
import { recipesUrl, recipeUrl } from "./routes";

export interface Recipe { id: string; name: string; description: string }
export type CreateRecipeRequest = Pick<Recipe, "name" | "description">;
export type UpdateRecipeRequest = Partial<CreateRecipeRequest>;
export type RecipeSearch = Search<"name" | "description" | "ingredientName", "id", "name" | "description">;

export const searchRecipes = searchEndpoint<Recipe, RecipeSearch>(`${recipesUrl}/search`);

export function readRecipe(id: string, signal: AbortSignal) {
  return requestJson<Recipe>(recipeUrl(id), { signal });
}
export async function createRecipe(fields: CreateRecipeRequest) {
  const [created] = await requestJson<Recipe[]>(recipesUrl, jsonWrite("POST", [fields]));
  if (!created?.id) throw new Error("Missing created recipe");
  return created;
}
export function updateRecipe(id: string, fields: UpdateRecipeRequest) {
  return requestJson<Recipe>(recipeUrl(id), jsonWrite("PATCH", fields));
}
export async function deleteRecipe(id: string): Promise<void> {
  await request(recipeUrl(id), { method: "DELETE" });
}
