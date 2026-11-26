# 05 · Ingredients on a recipe

Click “Ajouter un ingrédient” on a recipe. The picker first checks what is already linked, then lets you search the ingredient catalogue. Choosing a suggestion puts focus in “Quantité”; it does **not** save anything yet. Click “Ajouter” to save. The dialog closes on success and the ingredient section reloads from the server.

## Application code: follow one association

1. Start with [`RecipeDetail`](../../src/modules/recipes/components/recipe/RecipeDetail.tsx), then [`RecipeIngredients`](../../src/modules/recipes/components/ingredients/RecipeIngredients.tsx). The detail screen passes the recipe ID and a refresh signal as **props** (inputs to a component). The section owns the displayed page of memberships and keeps the selected action and unsaved quantity in **state** (values React remembers between screen updates). Keeping the draft here allows “Changer d’ingrédient” to replace a selection without clearing the quantity.
2. Read [`IngredientPicker`](../../src/modules/recipes/components/ingredients/IngredientPicker.tsx) alongside [`readLinkedIngredients`](../../src/modules/recipes/api/recipeIngredients.ts). The visible list can stop after 20 rows; it is **not** the exclusion list. Each time the membership picker opens, it follows the recipe’s ingredient pages from offset zero through `nextOffset` until complete. Only then does `Suggestions` show catalogue results, filtering each page by ingredient **ID**, not name. If the lookup fails, the picker offers a retry rather than offering potentially linked items.
3. Follow the `write` functions in `RecipeIngredients` to [the API functions](../../src/modules/recipes/api/recipeIngredients.ts). For `base = /v1/recipes/recipes/{recipeId}/ingredients`, the wire contracts are:

   | User action | Request |
   | --- | --- |
   | “Ajouter” | `POST base` with `[{ "ingredientId": "…", "quantity": " 250 g " }]` — an array even for one link. |
   | “Modifier la quantité : …” → “Enregistrer” | `PATCH base/{ingredientId}` with only `{ "quantity": " 300 g " }`. |
   | “Retirer de la recette : …” → “Retirer” | `DELETE base/{ingredientId}` without a body. This removes the association, **not** the catalogue ingredient. |

   Quantity is text: whitespace is trimmed **only to check for a blank field**. A nonblank value is sent exactly as entered, including surrounding spaces. A successful edit immediately displays the quantity returned by PATCH, so reopening the editor does not depend on the background refresh. After a duplicate-link error, choosing a different ingredient clears the alert and preserves the draft quantity.
4. Read [`WriteDialog`](../../src/core/WriteDialog.tsx) and [`dialogKeyboard`](../../src/core/dialogKeyboard.ts) for behavior shared with the picker or other forms. Tab stays inside the active dialog. A blank submission focuses “Quantité”; a failed write shows an alert without discarding the draft. A duplicate-link `409` prompts the user to choose another ingredient. While saving, repeat submits and dismissal are blocked. Removal initially focuses “Annuler”; cancelling sends nothing. Closing restores the opener when available. After successful removal the row button is gone, so focus returns to “Ajouter un ingrédient”.

## Test setup and check status

The [Given/When/Then component scenarios](../../tests/unit/modules/recipes/components/ingredients/RecipeIngredients.test.tsx) stub HTTP to check unseen-page exclusion, retry, exact quantity after a conflict, and focus after unlinking. The [Given/When/Then browser scenario](../../tests/e2e/recipe-ingredients.spec.ts) adds, edits and unlinks through the UI, reloads after each write, then searches for the original ingredient. Its SQL fixture creation and cleanup are test setup, not application operations. QA confirmed all 39 unit tests, type checking, the production build and all 6 Chromium E2E scenarios passed. The E2E suite ran against isolated FastAPI and PostgreSQL services.

## Suggested exercise (not a completed check)

On a disposable test recipe, link an existing test ingredient with “250 g”. Edit it to “300 g”, reload, then unlink it and reopen the picker. **Expected:** the recipe shows “300 g” after reload; after unlinking, the row disappears but the same ingredient is selectable again. Do not delete the catalogue ingredient.

**Known limitations:** the picker reads every membership page before showing choices, so large recipes may take longer. The exclusion list is a snapshot: another client can still add the same link before you save.
