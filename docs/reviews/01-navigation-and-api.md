# 01 — From the catalogue to a recipe

Open `/recipes` and select a recipe name. The browser opens `/recipes/<id>`. While the request is pending, the page says “Chargement de la recette…”. Once the response arrives, the recipe name becomes the heading and its description appears underneath. Reloading uses the ID in the URL; the detail screen does not need a previous visit to the catalogue.

## Reading order: application code

1. [App — choose the screen](../../src/app/App.tsx). `App` is a component: a function that describes what React should display. `/` and `/recipes` select `Catalogue`; a recipe URL containing a UUID selects `RecipeDetail`. `App` passes the ID as a **prop** (an input to a component). Ordinary links let the browser own the URL and Back history.
2. [Recipe API — choose the operation](../../src/modules/recipes/api/recipes.ts). `searchRecipes` sends `POST /v1/recipes/recipes/search` and returns a page of recipes. `readRecipe` gets one recipe by ID. This module owns the recipe contract, so the screens do not construct endpoint strings.
3. [Core HTTP — interpret the response](../../src/core/http.ts). `request` turns unsuccessful HTTP statuses into `HttpError`, preserves the status, and skips JSON decoding for `204`. The recipe reads use `requestJson`, which requires a body. Neither helper decides what the user sees.
4. [useRead — track one screen’s request](../../src/core/useRead.ts). Each screen owns its own **state**: values React remembers between updates. `useRead` shares the logic, not the data. It records loading, ready or error; changing state makes React update the screen. Retry starts another attempt, and a cancelled request cannot replace the current result.
5. [Catalogue](../../src/modules/recipes/Catalogue.tsx) and [RecipeDetail](../../src/modules/recipes/RecipeDetail.tsx) translate that state into text and controls. A successful list shows recipe links or “Aucune recette.” A detail `404` shows [MissingPage](../../src/core/MissingPage.tsx) with “Retour au catalogue”; other request failures show [RequestError](../../src/core/RequestError.tsx) with “Réessayer”. The recipe screen makes the domain decision; the shared components only display it.

## Read the scenarios, not the setup

- [Component scenarios](../../tests/unit/app/App.test.tsx): **Given** the catalogue is offline, **when** the user selects “Réessayer” after recovery, **then** “Aucune recette.” appears. The test supplies both responses through a substitute for `fetch`; it checks the screen, not backend availability. The [HTTP scenario](../../tests/unit/core/http.test.ts) checks the separate `204` contract.
- [Live navigation scenario](../../tests/e2e/shell.spec.ts): **Given** a real recipe, **when** the user opens it with the keyboard, reloads, and goes Back, **then** the detail survives reload and the catalogue link reappears on Back. Creating and deleting the recipe are test setup and cleanup, not UI features.
- **Verified:** all five unit tests, typecheck, and the production build passed. QA ran the Chromium navigation scenario against FastAPI and PostgreSQL. In a separate check, QA stopped and restarted the backend and confirmed that keyboard retry recovered without reloading the page. See the [test setup](../testing.md) to reproduce these checks.

## Before committing: try the missing-ID branch

Open `/recipes/not-a-uuid`. Expect “Recette introuvable” without a detail API request: `App` rejects the path before it selects `RecipeDetail`. Select “Retour au catalogue” and expect `/recipes` with the “Recettes” heading. This suggested exercise checks routing only; it does not verify a backend `404`. This block is read-only: filters and editing are outside its scope.
