import { requestJson } from "../../core/http";

export interface Recipe { id: string; name: string; description: string }

const recipes = "/v1/recipes/recipes";

export async function listRecipes(signal: AbortSignal) {
  const page = await requestJson<{ items: Recipe[] }>(`${recipes}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal,
  });
  return page.items;
}

export function readRecipe(id: string, signal: AbortSignal) {
  return requestJson<Recipe>(`${recipes}/${encodeURIComponent(id)}`, { signal });
}
