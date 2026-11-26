# 03 — Reading a recipe

Open a recipe by clicking its title in the catalogue. On `/recipes/:id`, the summary, “Ingrédients” and “Préparation” each load independently. You can read ingredient quantities even while the title is loading or the steps need a retry.

## Application code: follow one visit

1. Start with [`RecipeDetail`, `Ingredients` and `Preparation`](../../src/modules/recipes/RecipeDetail.tsx). `RecipeDetail` reads the name and description and passes the recipe ID to each section as a **prop** (an input to a React component). Each section owns its own request **state** (data React remembers and uses to update the screen). A section’s “Réessayer” repeats only its read. A `404` on the recipe itself is different: the entire detail view becomes “Recette introuvable”.
2. Match the sections to [the API functions](../../src/modules/recipes/api.ts). `readRecipeIngredients` asks for 20 rows at an offset; each `RecipeIngredientResponse` includes the ingredient name and quantity. `readSteps` sorts the returned steps by numeric `position` before rendering. The list keeps the original position numbers even if the response arrives out of order.
3. Follow “Plus d’ingrédients” into [`PageAction`](../../src/modules/recipes/PageAction.tsx). The ingredient section owns the loaded rows; the button calls the paging action it receives instead of fetching data itself. A failed continuation leaves earlier rows visible and offers “Réessayer” at the same offset. After success, if focus is still on the button, it moves to the first appended row. This split lets the catalogue and detail page share keyboard behavior without sharing their data.
4. Read [the detail stylesheet](../../src/modules/recipes/detail.css) alongside the two sections. On narrow screens, ingredients appear above preparation. At `48rem` and wider, they sit side by side, with more room for instructions; the summary text and placeholder image also sit side by side. These are layout changes, not new requests.

## Test setup, not application behavior

The executable Given/When/Then scenarios in [`RecipeDetail.test.tsx`](../../tests/unit/modules/recipes/RecipeDetail.test.tsx) control API responses to isolate a failed next page, keyboard retry and a steps failure while the summary is pending. The [app-level retry scenarios](../../tests/unit/app/App.test.tsx) cover focus when a retry returns 404. The [live browser scenario](../../tests/e2e/detail.spec.ts) opens an empty disposable recipe, seeds ingredients and steps, reloads, and checks quantities, step order and layout. Its writes and cleanup are test setup, not detail-page features.

QA confirmed all 18 unit tests passed, including the out-of-order steps scenario. All 4 Chromium E2E tests passed against the isolated FastAPI and PostgreSQL stack. Type checking and the production build passed. At 1536 px the detail view had a 70 px gutter; at 375 px the sections stacked without horizontal overflow.

## Suggested exercise

Open a recipe with more than 20 ingredients. Tab to “Plus d’ingrédients” and press Enter. Expect the existing rows to stay in place and focus to land on the first new ingredient. Narrow the window below `48rem`: expect “Préparation” beneath “Ingrédients”, with the loaded rows still visible.

**Limitations:** A short or empty recipe cannot demonstrate continuation. This block is read-only and uses a bundled placeholder rather than a recipe-specific photo.
