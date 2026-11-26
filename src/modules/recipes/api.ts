import { requestJson } from "../../core/http";
import type { Search } from "../../core/search/contract";
import { searchEndpoint } from "../../core/search/searchEndpoint";

export interface Recipe { id: string; name: string; description: string }

const recipes = "/v1/recipes/recipes";

export interface Ingredient { id: string; name: string }
export type RecipeSearch = Search<"name" | "description" | "ingredientName", "id", "name" | "description">;
export type IngredientSearch = Search<"name", "id", "name">;

export const searchRecipes = searchEndpoint<Recipe, RecipeSearch>(`${recipes}/search`);
export const searchIngredients = searchEndpoint<Ingredient, IngredientSearch>("/v1/recipes/ingredients/search");

export function readRecipe(id: string, signal: AbortSignal) {
  return requestJson<Recipe>(`${recipes}/${encodeURIComponent(id)}`, { signal });
}
