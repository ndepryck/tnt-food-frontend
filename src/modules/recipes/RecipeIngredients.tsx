import { useCallback, useRef, useState } from "react";
import { IconButton } from "../../core/IconButton";
import { usePagedSearch } from "../../core/search/usePagedSearch";
import { WriteDialog } from "../../core/WriteDialog";
import type { Ingredient } from "./api/ingredients";
import {
  addRecipeIngredient,
  type RecipeIngredientResponse,
  readLinkedIngredients,
  readRecipeIngredients,
  removeRecipeIngredient,
  updateRecipeIngredient,
} from "./api/recipeIngredients";
import { IngredientPicker } from "./IngredientPicker";
import { PageAction } from "./PageAction";
import { recipeVisits } from "./recipeHistory";

type Action =
  | { kind: "add"; ingredient: Ingredient }
  | { kind: "edit" | "remove"; row: RecipeIngredientResponse };

export function RecipeIngredients({
  id,
  validation,
}: {
  id: string;
  validation: number;
}) {
  const [revision, setRevision] = useState(0);
  const results = usePagedSearch(
    readRecipeIngredients,
    id,
    revision + validation,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const [picking, setPicking] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [quantity, setQuantity] = useState("");
  const loadExcluded = useCallback(
    (signal: AbortSignal) => readLinkedIngredients(id, signal),
    [id],
  );
  function changed() {
    recipeVisits.written(id);
    setAction(null);
    setRevision((n) => n + 1);
  }
  return (
    <section aria-labelledby="ingredient-heading">
      <h2 id="ingredient-heading" tabIndex={-1} ref={heading}>
        Ingrédients
      </h2>
      {results.items.length > 0 && (
        <ul className="memberships" ref={list}>
          {results.items.map((row) => (
            <li key={row.ingredientId} tabIndex={-1}>
              <span>{row.ingredientName}</span>
              <span>{row.quantity}</span>
              <div className="recipe-actions">
                <IconButton
                  icon="edit"
                  label={`Modifier la quantité : ${row.ingredientName}`}
                  onClick={() => {
                    setQuantity(row.quantity);
                    setAction({ kind: "edit", row });
                  }}
                />
                <IconButton
                  icon="unlink"
                  label={`Retirer de la recette : ${row.ingredientName}`}
                  onClick={() => setAction({ kind: "remove", row })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {results.pending && <p role="status">Chargement des ingrédients…</p>}
      {results.failed && (
        <p role="alert">Impossible de charger les ingrédients.</p>
      )}
      {results.current && !results.items.length && !results.action && (
        <p>Aucun ingrédient.</p>
      )}
      <PageAction
        results={results}
        query={id}
        list={list}
        fallback={heading}
        label="Plus d’ingrédients"
      />
      <button
        type="button"
        ref={add}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.currentTarget.focus();
          setQuantity("");
          setPicking(true);
        }}
      >
        Ajouter un ingrédient
      </button>
      {action?.kind === "remove" && (
        <WriteDialog
          title="Retirer cet ingrédient ?"
          confirmation={`Retirer « ${action.row.ingredientName} » de cette recette ? L’ingrédient restera dans le catalogue.`}
          submitLabel="Retirer"
          failure="Impossible de retirer cet ingrédient."
          close={() => setAction(null)}
          fallback={add}
          write={async () => {
            await removeRecipeIngredient(id, action.row.ingredientId);
            // Remove the invoker with the dialog so focus returns to the add button.
            results.refresh((rows) =>
              rows.filter(
                (row) => row.ingredientId !== action.row.ingredientId,
              ),
            );
            changed();
          }}
        />
      )}
      {action && action.kind !== "remove" && (
        <WriteDialog
          title={
            action.kind === "add"
              ? "Ajouter un ingrédient"
              : "Modifier la quantité"
          }
          submitLabel={action.kind === "add" ? "Ajouter" : "Enregistrer"}
          failure="Impossible d’enregistrer la quantité."
          conflict="Cet ingrédient est déjà associé à la recette. Choisissez un autre ingrédient."
          feedbackKey={
            action.kind === "add"
              ? action.ingredient.id
              : action.row.ingredientId
          }
          close={() => setAction(null)}
          fallback={add}
          fields={(busy) => (
            <>
              <p>
                Ingrédient :{" "}
                <strong>
                  {action.kind === "add"
                    ? action.ingredient.name
                    : action.row.ingredientName}
                </strong>
              </p>
              {action.kind === "add" && (
                <button
                  type="button"
                  className="outline"
                  aria-haspopup="dialog"
                  disabled={busy}
                  onClick={(e) => {
                    e.currentTarget.focus();
                    setPicking(true);
                  }}
                >
                  Changer d’ingrédient
                </button>
              )}
              <label>
                Quantité
                <input
                  data-initial-focus
                  required
                  readOnly={busy}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
            </>
          )}
          write={async () => {
            if (action.kind === "add")
              await addRecipeIngredient(id, action.ingredient.id, quantity);
            else {
              const updated = await updateRecipeIngredient(
                id,
                action.row.ingredientId,
                quantity,
              );
              results.refresh((rows) =>
                rows.map((row) =>
                  row.ingredientId === updated.ingredientId ? updated : row,
                ),
              );
            }
            changed();
          }}
        />
      )}
      {picking && (
        <IngredientPicker
          excluded={[]}
          loadExcluded={loadExcluded}
          close={() => setPicking(false)}
          choose={(ingredient) => {
            setPicking(false);
            setAction({ kind: "add", ingredient });
          }}
        />
      )}
    </section>
  );
}
