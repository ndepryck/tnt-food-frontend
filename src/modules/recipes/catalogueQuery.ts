import type { Ingredient } from "./api/ingredients";
import type { RecipeSearch } from "./api/recipes";

type RecipeFilter = NonNullable<RecipeSearch["filter"]>;

export const sorts = {
  nameAsc: ["Nom A–Z", "name", "ASC"],
  nameDesc: ["Nom Z–A", "name", "DESC"],
  descriptionAsc: ["Description A–Z", "description", "ASC"],
  descriptionDesc: ["Description Z–A", "description", "DESC"],
} as const;
export interface Controls {
  text: string;
  ingredients: Ingredient[];
  mode: "AND" | "OR";
  sort: keyof typeof sorts;
}
const key = "recipes:catalogue:v1";
const defaults: Controls = { text: "", ingredients: [], mode: "AND", sort: "nameAsc" };

export function restore(): Controls {
  try {
    const c = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (c && typeof c.text === "string" && Object.hasOwn(sorts, c.sort)
        && ["AND", "OR"].includes(c.mode) && Array.isArray(c.ingredients)
        && c.ingredients.every((i: Ingredient) => typeof i?.id === "string" && typeof i.name === "string")) return c;
  } catch { /* Storage may be unavailable. */ }
  return defaults;
}
export function remember(c: Controls) {
  try { sessionStorage.setItem(key, JSON.stringify(c)); } catch { /* Optional persistence. */ }
}

export function catalogueQuery(c: Controls): RecipeSearch {
  const children: RecipeFilter[] = [];
  const value = c.text.trim();
  if (value) children.push({ logicalOperator: "OR", children: [
    { attribute: "name", filterOperator: "CONTAINS", value },
    { attribute: "description", filterOperator: "CONTAINS", value },
  ] });
  const ingredients = c.ingredients.map(({ name }): RecipeFilter => ({
    attribute: "ingredientName", filterOperator: "EQ", value: name,
  }));
  if (ingredients.length) children.push(ingredients.length === 1 ? ingredients[0] : { logicalOperator: c.mode, children: ingredients });
  const [, attribute, direction] = sorts[c.sort];
  return {
    filter: children.length > 1 ? { logicalOperator: "AND", children } : children[0],
    sort: { attribute, direction }, limit: 12,
  };
}
