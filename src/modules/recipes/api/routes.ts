export const recipesUrl = "/v1/recipes/recipes";
export const recipeUrl = (id: string) =>
  `${recipesUrl}/${encodeURIComponent(id)}`;
