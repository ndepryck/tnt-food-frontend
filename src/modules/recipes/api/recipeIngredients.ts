import { jsonWrite, request, requestJson } from "../../../core/http";
import type { Page } from "../../../core/search/contract";
import type { Ingredient } from "./ingredients";
import { recipeUrl } from "./routes";

export interface RecipeIngredientResponse {
  ingredientId: string;
  ingredientName: string;
  quantity: string;
}

const memberships = (id: string) => `${recipeUrl(id)}/ingredients`;

export function readRecipeIngredients(
  id: string,
  offset: number,
  signal: AbortSignal,
) {
  return requestJson<Page<RecipeIngredientResponse>>(
    `${memberships(id)}?limit=20&offset=${offset}`,
    { signal },
  );
}

export async function readLinkedIngredients(id: string, signal: AbortSignal) {
  const linked: Ingredient[] = [];
  let offset: number | null = 0;
  do {
    const page: Page<RecipeIngredientResponse> = await readRecipeIngredients(
      id,
      offset,
      signal,
    );
    linked.push(
      ...page.items.map((row) => ({
        id: row.ingredientId,
        name: row.ingredientName,
      })),
    );
    offset = page.hasMore ? page.nextOffset : null;
  } while (offset !== null);
  return linked;
}

export function addRecipeIngredient(
  id: string,
  ingredientId: string,
  quantity: string,
) {
  return requestJson<RecipeIngredientResponse[]>(
    memberships(id),
    jsonWrite("POST", [{ ingredientId, quantity }]),
  );
}
export function updateRecipeIngredient(
  id: string,
  ingredientId: string,
  quantity: string,
) {
  return requestJson<RecipeIngredientResponse>(
    `${memberships(id)}/${encodeURIComponent(ingredientId)}`,
    jsonWrite("PATCH", { quantity }),
  );
}
export async function removeRecipeIngredient(id: string, ingredientId: string) {
  await request(`${memberships(id)}/${encodeURIComponent(ingredientId)}`, {
    method: "DELETE",
  });
}
