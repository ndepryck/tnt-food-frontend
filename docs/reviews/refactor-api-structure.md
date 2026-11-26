# Slice 1 — Follow a catalogue search through the resource API

Type `soupe` in “Rechercher une recette”. The text changes immediately; after a 250 ms pause, the catalogue searches recipe names and descriptions and displays the matching cards. This slice changes where the screen imports its API calls, not what the user sees or what the backend receives.

## Reading order: application code

1. Start in [`Catalogue.tsx` → `Catalogue`](../../src/modules/recipes/components/catalogue/Catalogue.tsx). The screen owns the draft text and the applied filters as **state**: values React remembers between updates and uses to redraw the screen. Follow `draft` into `controls.text`, then into [`catalogueQuery`](../../src/modules/recipes/components/catalogue/catalogueQuery.ts), which translates the controls into a backend filter. `usePagedSearch` manages the result pages; `Catalogue` displays each returned recipe through `RecipeCard`.
2. Follow the import to [`api/recipes.ts`](../../src/modules/recipes/api/recipes.ts). It owns the `Recipe` response type and recipe search, read and write calls. Compare the import in [`IngredientPicker`](../../src/modules/recipes/components/ingredients/IngredientPicker.tsx): the picker searches the global ingredient catalogue, not recipes.

   ```ts
   // Catalogue.tsx
   import { type Recipe, searchRecipes } from "../../api/recipes";
   // IngredientPicker.tsx
   import {
     type Ingredient,
     type IngredientSearch,
     searchIngredients,
   } from "../../api/ingredients";
   ```

3. Compare [`api/ingredients.ts`](../../src/modules/recipes/api/ingredients.ts) with [`api/recipeIngredients.ts`](../../src/modules/recipes/api/recipeIngredients.ts). An ingredient has a name; its quantity belongs to its association with **one recipe**. That is why a quantity update does not sit beside global search. [`api/recipeSteps.ts`](../../src/modules/recipes/api/recipeSteps.ts) owns ordered steps. These resource files use [recipe routes](../../src/modules/recipes/api/routes.ts) where needed; generic JSON write options belong in [core HTTP](../../src/core/http.ts), which need not know what a recipe is.

## Project guidance and test setup

The [structure guideline](../guidelines/frontend-structure.md) shows the current layout. The first slice split the API by resource; the second grouped components with their styles and moved recipe-specific navigation under `navigation/`. [AGENTS.md](../../AGENTS.md) points to the canonical [structure](../../.agents/skills/frontend-structure/SKILL.md) and [testing](../../.agents/skills/frontend-testing/SKILL.md) skills under `.agents/skills/`; the OpenCode skill files refer to those instructions using ordinary Markdown links.

Read the executable scenario [“Given a pending catalogue, When I finish typing, Then only the debounced query can replace the cards”](../../tests/unit/modules/recipes/components/catalogue/Catalogue.test.tsx#L62). Unlike application code, the test replaces each search module with a mock and controls time. It returns “Soupe” for the latest search, then resolves the older request with “Tarte” and checks that “Soupe” stays visible. The [recipe action tests](../../tests/unit/modules/recipes/components/recipe/RecipeActions.test.tsx) likewise mock the owning recipe API file rather than the removed `api.ts`.

**Completed checks:** Type checking, all 48 unit tests, and the production build passed. Independent QA also ran all 8 browser scenarios successfully against the isolated FastAPI backend and PostgreSQL database.

**Suggested exercise:** Run `npm run test:unit -- -t "Given a pending catalogue"` and trace the final two assertions back to `RecipeCard`. **Expected:** the search scenario passes; “Soupe” is a link and “Tarte” is absent. This exercise uses controlled responses so the older request can finish last.
