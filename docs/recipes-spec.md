# TNT Food recipe catalogue and editor

## Goal and baseline

A cook can find a recipe, open its ingredients and instructions, and maintain the recipe from the same local web app. The current frontend starts at a minimal welcome page. This specification describes the target behavior in six independently verifiable blocks. [Mockups, assets and design rules](design/recipes/README.md).

Scope covers local development with React, TypeScript and Vite against the existing FastAPI API. Recipe photos, durations, servings, production deployment, accounts and ingredient catalogue management are outside this feature.

## 1. App shell and API connection

- Provide the catalogue at `/recipes` and recipe details at `/recipes/:recipeId`. The root opens the catalogue. The shared header links to the catalogue.
- Use a typed API module with same-origin `/v1` URLs. Configure Vite to proxy to the local backend, with a configurable target for Compose. Keep HTTP handling and JSON decoding in the API module. Read `204` responses without parsing JSON.
- Show a loading state while the first request is pending, a French error and retry for recoverable failures, and a clear missing-recipe view with a link back when a recipe returns `404`.

**Acceptance.** The catalogue opens at the root. Reloading a known detail URL shows the same recipe, back navigation works, and stopping the API produces a recoverable state without a blank screen.

## 2. Catalogue and live filters

- Display recipe titles and the bundled placeholder in a responsive grid. The title or image opens the detail. Keep **Nouvelle recette** visible and use pencil and trash icons on each card when block 4 is complete.
- Search name or description with case-insensitive `CONTAINS`. Apply the text filter automatically after about 250 ms of inactivity. The clear icon resets the search text while preserving the remaining filters.
- Open the ingredient picker with **+ Ingrédient**. Search the ingredient catalogue by name and show selected ingredients as removable chips. Support pagination of suggestions and omit already selected items. Users can add and remove selections with the keyboard.
- With two or more selected ingredients, show **Tous / Au moins un**, defaulting to **Tous**. Use one `ingredientName` condition per selection, grouped with `AND` for all or `OR` for any. Use exact name matching for selections from suggestions. Combine the ingredient group with the name-or-description search using `AND`. Changes to chips, the mode or the sort apply immediately.
- Offer **Nom A–Z**, **Nom Z–A**, **Description A–Z** and **Description Z–A**. Default to **Nom A–Z**. On any query change, restart pagination at offset zero. Use the returned `nextOffset` for **Plus de recettes** with the same query. Preserve the applied catalogue controls on navigation to a recipe and back during the same session.
- Keep stale responses from replacing newer results. During background refreshes, keep the existing list visible until the new one arrives. Distinguish loading, empty results and request errors. A retry uses the active filters.

**Acceptance.** Typing shows new results without submitting. Clearing the text preserves ingredient chips. Selecting two ingredients produces different results in **Tous** and **Au moins un** when a recipe has only one of them. Reversing the sort refreshes results. A slow old request cannot overwrite a newer query or append items to its result set.

## 3. Recipe detail

- Fetch the recipe, its ingredient memberships and its steps. Show the title, description and placeholder. Display ingredient names and quantities as returned. Follow ingredient pagination until the list is complete, or present an explicit control to load more.
- Show steps in API position order. Show an empty state independently for ingredients and steps. If a section fails, explain which section is unavailable and provide a retry. Keep any sections that loaded successfully readable.
- On wide screens, show ingredients and preparation side by side. Stack them in that order on narrow screens.

**Acceptance.** A seeded recipe displays its real ingredients and ordered steps. A newly created empty recipe displays both empty sections. A failed ingredient request does not make successful recipe information unreadable.

## 4. Recipe creation, editing and deletion

- **Nouvelle recette** opens a dialog with required **Nom** and **Description**. The API accepts a batch. Submit a one-element array and navigate to the returned recipe on success.
- The pencil on a card or detail page opens the same dialog prefilled. Save through the recipe PATCH endpoint and refresh the affected list or detail.
- The trash icon opens a confirmation naming the recipe. After deletion, refresh the catalogue and return to it if the user was on the deleted recipe. Preserve catalogue filters.

**Acceptance.** A new recipe opens immediately, saving a changed name updates the visible recipe, cancelling deletion preserves it, and confirming removes it from the catalogue.

## 5. Ingredients within a recipe

- **Ajouter un ingrédient** uses the same catalogue picker. Require one existing ingredient and a nonblank free-text quantity such as `1 c. à café`. Submit a one-element membership array. Keep the typed quantity intact.
- The pencil edits only the quantity and identifies the ingredient. The circled minus confirms removal from this recipe. Handle duplicate membership errors and keep the dialog open when a save fails.
- Refresh memberships after successful mutations and exclude linked ingredients from suggestions.

**Acceptance.** Select an ingredient, save `250 g`, edit it to `300 g`, then remove the association. The ingredient remains available in the global catalogue.

## 6. Preparation steps

- **Ajouter une étape** requires an instruction and accepts an optional position. Omit the position when left blank so the API appends the step. The pencil edits the instruction or position.
- Up and down arrows move to the adjacent step's position. Show only moves that are possible. While a move is pending, prevent competing step mutations in this view. Refresh the list after a success so the API determines the final numbering.
- The trash icon confirms deletion of the chosen step. Use the positions returned after refreshing to reflect compaction.

**Acceptance.** Append an instruction, insert one at the start, move it down, edit its text, then delete it. After each operation and a reload, the displayed order matches the API.

## API mapping

Use the current neighboring backend implementation as the source of truth for request and response details. In this table, `R` is `/v1/recipes/recipes` and `I` is `/v1/recipes/ingredients`.

| Operation | API | Contract to preserve |
| --- | --- | --- |
| Search recipes / ingredients | `POST R/search`, `POST I/search` | `filter`, `sort`, `limit`, `offset`. Groups use `logicalOperator` and `children`. Conditions use `attribute`, `filterOperator` and `value`. Sort uses `attribute` and `direction`. Pages use `items`, `hasMore` and `nextOffset`. |
| Read / create / edit / delete a recipe | `GET R/{id}`, `POST R`, `PATCH R/{id}`, `DELETE R/{id}` | Create uses an array of `{name, description}` and returns an array. Delete returns `204`. |
| List / add recipe ingredients | `GET R/{id}/ingredients`, `POST R/{id}/ingredients` | List is paginated with `ingredientId`, `ingredientName` and `quantity`. Add uses an array of `{ingredientId, quantity}`. |
| Edit / remove recipe ingredient | `PATCH R/{id}/ingredients/{ingredientId}`, `DELETE R/{id}/ingredients/{ingredientId}` | Patch the quantity text. Delete returns `204`. |
| List / add steps | `GET R/{id}/steps`, `POST R/{id}/steps` | List returns an ordered array. Create sends `description` and optionally `position`. |
| Edit / remove steps | `PATCH R/{id}/steps/{stepId}`, `DELETE R/{id}/steps/{stepId}` | Patch `description` and/or `position`. Delete returns `204`. |

## Shared interaction and verification

- Reuse one confirmation pattern and one save pattern. Trap focus within a dialog, allow Escape when no write is in progress, and restore focus on close or move it to a logical control if the invoker was removed. Prevent double submission. Keep input on failure and show useful feedback in French.
- Follow the [design guide](design/recipes/README.md) for color, responsive behavior, icon names and focus. Icon tooltips supplement accessible names.
- After each block, run `npm run typecheck` and `npm run build`. Exercise the block in the browser against the local API, with keyboard and narrow viewport checks for changed screens. Use a disposable recipe for destructive checks.
- In OpenCode, ask `frontend-orchestrator` to implement one named block. Include prerequisites if earlier blocks are missing. Have the implementation, review, QA and walkthrough refer to that block's acceptance criteria.

## Automated tests required for each block

- **Test setup (block 1):** Provide `npm run test:unit` for component tests and `npm run test:e2e` for browser tests. Document how to start the frontend and the real FastAPI backend against a local test database, prepare test data, and run both suites.
- **Component unit tests (implementer):** Deliver tests with each block, in `tests/unit/` outside the application source. Follow the [testing skill](../.opencode/skills/frontend-testing/SKILL.md) for Given/When/Then scenarios in unit and browser tests. Render the component, interact through its controls, and assert what the user can see or do. Stub the API boundary when needed to exercise cases such as a stale search response, a failed detail section, or a dialog retaining its input after a failed save.
- **End-to-end tests (implementer):** Automate at least one acceptance flow per block in a browser through the frontend and its `/v1` proxy to the running backend, without mocking API responses. Cover direct navigation and reload, catalogue filtering, recipe detail, recipe CRUD, ingredient membership changes, and step ordering as those blocks land. Create disposable records and clean them up so the suite can be rerun. For writes, check the result after a reload.
- **Verification (QA):** Run the component suite and the full end-to-end suite after each block. Report the commands, results, and failing scenarios. A manual browser check or a run with a mocked backend does not count as an end-to-end pass. If the real stack cannot be started or reached, mark the E2E check as blocked and report the cause.
