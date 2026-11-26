import type { Search } from "../../../core/search/contract";
import { searchEndpoint } from "../../../core/search/searchEndpoint";

export interface Ingredient {
  id: string;
  name: string;
}
export type IngredientSearch = Search<"name", "id", "name">;

export const searchIngredients = searchEndpoint<Ingredient, IngredientSearch>(
  "/v1/recipes/ingredients/search",
);
