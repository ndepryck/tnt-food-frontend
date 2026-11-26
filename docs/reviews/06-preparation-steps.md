# 06 · Preparation steps

Drag “Déplacer l’étape 2” onto the first instruction under “Préparation”. A line appears before the first row, but the numbers do not change yet. Release there: the page shows “Déplacement de l’étape…”. The new step 1 appears only after the app reads the saved order back from the API.

## Reading order: application code

1. [RecipeDetail](../../src/modules/recipes/components/recipe/RecipeDetail.tsx) passes the recipe ID to [RecipeSteps and StepEditor](../../src/modules/recipes/components/steps/RecipeSteps.tsx). These inputs are **props**: values or functions supplied by a parent component. `StepEditor` owns the fetched list and the current operation. Its **state** is information React remembers between screen updates, such as which dialog is open. The server owns the saved positions.
2. [StepList](../../src/modules/recipes/components/steps/StepList.tsx) owns only the gesture. The handle captures the pointer so it keeps receiving events across rows. Holding it near the viewport edge scrolls the page until the first or last row is reachable; the marker updates even while the pointer is still. The marker appears before the target when moving up and after it when moving down. On release, `StepList` checks the row again and calls the parent’s `move(step, position)`. Escape, an outside release or a drop on the original row sends nothing.
3. [StepEditor](../../src/modules/recipes/components/steps/RecipeSteps.tsx) calls [`updateRecipeStep`](../../src/modules/recipes/api/recipeSteps.ts): `PATCH /v1/recipes/recipes/{recipeId}/steps/{stepId}` with just `{ position }`. The ID identifies the instruction even when its number changes. While the move is pending, competing writes are blocked. If it fails, the old list stays visible and retry repeats that move. The move focuses “Préparation” when it starts. On success, the editor marks the recipe as changed and keeps the last list visible with writes locked while the GET refreshes server-assigned positions. A slow refresh shows “Actualisation des étapes…”. If this read fails, retry repeats **only the GET**, not the write.
4. [StepDialog](../../src/modules/recipes/components/steps/StepDialog.tsx) is the non-drag route. Open “Modifier l’étape 2”, change “Position” to `1` and choose “Enregistrer”: the same PATCH and refresh follow. Editing sends only changed fields; an unchanged form closes without a request. “Ajouter une étape” POSTs an instruction to the collection: leave “Position (facultative)” blank to append or enter a valid position to insert. “Supprimer l’étape 1” quotes the instruction for confirmation before DELETE. [WriteDialog](../../src/core/WriteDialog.tsx) handles pending submission and dismissal locks, so the step form only needs to own its fields. A failed write leaves the dialog open for correction or retry.

## Test setup and verification status

- [Live Given/When/Then scenario: empty recipe → edit steps → numbering persists](../../tests/e2e/recipe-steps.spec.ts#L4). The test creates and cleans up its own recipe. It compares the numbered UI with the API response and reloads the page; those checks are test code, not extra reads performed by the app.
- [Component scenarios](../../tests/unit/modules/recipes/components/steps/RecipeSteps.test.tsx#L53) stub requests to exercise cancelled drops, failed moves, form retries and a failed refresh after deletion.
- The implementation passed 48 unit tests, type checking, the production build and all 8 Chromium E2E scenarios against isolated FastAPI and PostgreSQL services. The long-list regression exercises dragging to both ends of a 14-step list at 390 × 540. Touch was checked with Chromium emulation, not a physical device.

## Suggested exercise (not a completed check)

On a disposable local test recipe, append “A” then “B”. Drag “B” onto “A” and reload. **Expected:** `1. B`, `2. A`. Use “Modifier l’étape 2” to set “Position” to `1`, then reload: expect `1. A`, `2. B`. Remove only your disposable fixture afterward.

**Limitations:** There is no drag target outside the list or move handle available for a lone step. Keyboard users can set “Position” in the edit dialog rather than simulating a drag.
