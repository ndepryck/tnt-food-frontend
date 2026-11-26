# Frontend file structure

Start with the domain module, then choose a home according to what is changing. Recipes use this layout:

```text
src/modules/recipes/
  api/                     recipes.ts, ingredients.ts, recipeIngredients.ts, recipeSteps.ts, routes.ts
  components/
    catalogue/             Catalogue.tsx, catalogueQuery.ts, catalogue.css
    recipe/                RecipeDetail.tsx, RecipeActions.tsx, detail.css
    ingredients/           IngredientPicker.tsx, RecipeIngredients.tsx
    steps/                 RecipeSteps.tsx, StepDialog.tsx, StepList.tsx
  navigation/              recipeHistory.ts, writeNavigation.ts
```

**API: group by backend resource.** Keep a resource's reads, writes and request/response types in the same file. Use the backend's terminology. Searching the global ingredient catalogue belongs in `api/ingredients.ts`; updating a quantity belongs in `api/recipeIngredients.ts` because the quantity is part of the association. Import directly from the resource file rather than recreating a single API entry point with re-exports.

**Components: group by what the user sees or does.** A detail screen can compose several resources. Put its list, dialogs, local styles and UI-specific logic near the component that owns them. For example, filter controls become a backend query in `components/catalogue/catalogueQuery.ts`. Create a folder when there is code to put in it.

**Shared code: check the dependency direction.** `src/app/` composes screens. A domain module can import `src/core/`, but core cannot import a domain module. A dialog that handles keyboard focus can be shared, as can the load/retry button in [`src/core/search/PageAction.tsx`](../../src/core/search/PageAction.tsx); a picker that searches ingredients stays in the domain. Cross-screen logic specific to recipes, such as invalidating a cached recipe page after a write, belongs in the module's `navigation/`.

**Tests:** mirror the owner's path under `tests/unit/` (for example, `tests/unit/modules/recipes/components/steps/RecipeSteps.test.tsx`). Keep browser tests under `tests/e2e/`, named for the user flow, since they can cross several components and resources.
