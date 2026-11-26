import { useState, type RefObject } from "react";
import { createRecipe, deleteRecipe, updateRecipe, type Recipe, type UpdateRecipeRequest } from "./api";
import { IconButton } from "../../core/IconButton";
import { WriteDialog } from "../../core/WriteDialog";
import { navigateAfterWrite } from "./writeNavigation";
import { recipeVisits } from "./recipeHistory";

export type RecipeAction = { kind: "create" } | { kind: "edit" | "delete"; recipe: Recipe };

export function RecipeButtons({ recipe, open }: { recipe: Recipe; open: (action: RecipeAction) => void }) {
  return <div className="recipe-actions">
    <IconButton icon="edit" label={`Modifier la recette : ${recipe.name}`} onClick={() => open({ kind: "edit", recipe })} />
    <IconButton icon="delete" label={`Supprimer la recette : ${recipe.name}`} onClick={() => open({ kind: "delete", recipe })} />
  </div>;
}

export function RecipeDialog({ action, close, changed, fallback }: {
  action: RecipeAction; close: () => void; changed: (recipe: Recipe | null) => void;
  fallback?: RefObject<HTMLElement | null>;
}) {
  const recipe = action.kind === "create" ? undefined : action.recipe;
  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  if (action.kind === "delete") return <WriteDialog fallback={fallback} title="Supprimer la recette ?" submitLabel="Supprimer"
    confirmation={`Supprimer définitivement la recette « ${action.recipe.name} » ?`} failure="Impossible de supprimer la recette."
    close={close} write={async () => {
      await deleteRecipe(action.recipe.id);
      recipeVisits.written(action.recipe.id);
      changed(null);
    }} />;
  return <WriteDialog fallback={fallback} title={recipe ? "Modifier la recette" : "Nouvelle recette"} submitLabel={recipe ? "Enregistrer" : "Créer"}
    failure="Impossible d’enregistrer la recette." close={close}
    write={async () => {
      if (recipe) {
        const patch: UpdateRecipeRequest = {};
        if (name !== recipe.name) patch.name = name;
        if (description !== recipe.description) patch.description = description;
        if (!Object.keys(patch).length) { close(); return; }
        const updated = await updateRecipe(recipe.id, patch);
        recipeVisits.written(updated.id);
        changed(updated);
      } else {
        const created = await createRecipe({ name, description });
        recipeVisits.written(created.id);
        navigateAfterWrite(`/recipes/${created.id}`);
      }
    }}
    fields={busy => <>
      <label>Nom<input data-initial-focus required value={name} readOnly={busy} onChange={e => setName(e.target.value)} /></label>
      <label>Description<textarea required rows={4} value={description} readOnly={busy} onChange={e => setDescription(e.target.value)} /></label>
    </>} />;
}
