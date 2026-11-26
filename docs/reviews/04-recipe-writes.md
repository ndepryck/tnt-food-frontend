# 04 · Recipe writes

Click “+ Nouvelle recette” in a filtered catalogue. A dialog opens with focus on “Nom”. Fill in “Nom” and “Description”, then click “Créer”. On success you land on the new recipe’s detail page, even if the recipe does not match the catalogue filter. Back takes you to the catalogue, not to the form.

## Application code: follow the write

1. Start in [`Catalogue`](../../src/modules/recipes/Catalogue.tsx). It owns the filter controls and the selected action as **state**: values React remembers between screen updates. Clicking the create button selects `create`, so the screen displays `RecipeDialog`. For edit and delete, `RecipeButtons` passes the selected recipe along with the action.
2. Read [`RecipeDialog`](../../src/modules/recipes/RecipeActions.tsx) beside [`WriteDialog`](../../src/core/WriteDialog.tsx). The former owns the unsaved field values and decides what to send. It passes fields and a write function to the latter as **props** (inputs supplied by a parent component). `WriteDialog` handles the mechanics shared by all three actions: focus, blank-field validation, blocking duplicate submissions, and showing errors without clearing the draft. Delete names the recipe and initially focuses “Annuler”; cancelling sends nothing.
3. Follow the submit function into [the recipe API](../../src/modules/recipes/api.ts). Create sends `POST` with a one-element array and uses the returned ID for navigation. Edit compares both fields with the original recipe: changing only the description sends `PATCH` with only `description`. Reverting every change before “Enregistrer” closes the dialog **without a PATCH or refresh**. Confirming “Supprimer” sends `DELETE` for that ID.
4. Follow the result back to its screen. [`RecipeDetail`](../../src/modules/recipes/RecipeDetail.tsx) displays the recipe returned by PATCH using [`useRead.replace`](../../src/core/useRead.ts); deletion from detail navigates to `/recipes`. In `Catalogue`, edit replaces the card data and delete removes the card immediately **after success**. [`usePagedSearch`](../../src/core/search/usePagedSearch.ts) then requests page one with the same filters and sort, so the server decides which cards belong and in what order.
5. Trace keyboard focus. Closing the dialog restores its opener; catalogue search is the fallback if the focused card disappears. On create or detail-page deletion, [write navigation](../../src/modules/recipes/writeNavigation.ts) marks the destination heading for focus using a one-time session-storage hint. Ordinary Back does not use that hint.
6. Open a second-page card, then go Back. [`recipeHistory`](../../src/modules/recipes/recipeHistory.ts) helps [`App`](../../src/app/App.tsx) decide whether the restored page is still current. If no relevant write occurred and the browser can confirm that, the cards and focused link stay in place without a new search. A successful write invalidates the catalogue and the affected recipe. If freshness is unknown, the catalogue keeps its filters, cards and focus while it rechecks the loaded pages. A failed check leaves the results readable and offers a retry.

## Test setup and verification status

The [Given/When/Then browser scenario](../../tests/e2e/recipe-crud.spec.ts) starts with a filtered catalogue, creates a uniquely named recipe, edits it, cancels and confirms deletion, then checks reload and Back. Its direct API calls verify deletion and clean up the fixture; they are not application code.

The [dialog scenarios](../../tests/unit/modules/recipes/RecipeActions.test.tsx) stub HTTP to inspect partial writes, retry, focus and the reverted-edit no-op. The [App scenarios](../../tests/unit/app/App.test.tsx) check focus and loaded cards on a cached return. The [history scenarios](../../tests/unit/modules/recipes/recipeHistory.test.ts) distinguish a write to the displayed recipe from a write to another ID and cover unavailable storage.

QA confirmed 34 unit tests, type checking, the production build and all 5 Chromium E2E scenarios passed. The E2E suite used isolated FastAPI and PostgreSQL services. Additional Chromium checks disabled the Navigation API and restricted session storage: Back preserved the focused 13th link after reading, and removed a recipe renamed outside the active filter after editing. Recovery from a 503 during revalidation was tested at the component boundary.

## Try it on disposable data

In an isolated test database, filter by a fresh unique token and create a recipe whose name contains it. On detail, open the browser Network panel, edit only “Description” and save. Reopen the dialog and save unchanged. Go Back and delete **only your token-labelled card**.

**Expected:** one description-only PATCH, no second PATCH, and the same filter with no matching card after deletion. **Limits:** this block writes only recipe names and descriptions, not ingredients or steps. When history information is unavailable, rechecking the catalogue can take one request per loaded page. Destination-heading focus is best effort if session storage is unavailable.
