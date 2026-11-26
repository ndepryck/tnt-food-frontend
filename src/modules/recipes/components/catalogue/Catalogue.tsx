import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import placeholder from "../../../../assets/recipe-placeholder.png";
import { PageAction } from "../../../../core/search/PageAction";
import { usePagedSearch } from "../../../../core/search/usePagedSearch";
import { type Recipe, searchRecipes } from "../../api/recipes";
import { useWriteArrivalFocus } from "../../navigation/writeNavigation";
import { IngredientPicker } from "../ingredients/IngredientPicker";
import {
  type RecipeAction,
  RecipeButtons,
  RecipeDialog,
} from "../recipe/RecipeActions";
import {
  type Controls,
  catalogueQuery,
  remember,
  restore,
  sorts,
} from "./catalogueQuery";
import "./catalogue.css";

function RemoveButton({
  label,
  remove,
}: {
  label: string;
  remove: () => void;
}) {
  return (
    <button
      type="button"
      className="remove"
      aria-label={label}
      onClick={remove}
    >
      ×
      <span aria-hidden="true" className="tooltip">
        {label}
      </span>
    </button>
  );
}

function RecipeCard({
  recipe,
  open,
  fallback,
}: {
  recipe: Recipe;
  open: (action: RecipeAction) => void;
  fallback: RefObject<HTMLInputElement | null>;
}) {
  const row = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const node = row.current;
    return () => {
      if (node?.contains(document.activeElement)) fallback.current?.focus();
    };
  }, [fallback]);
  return (
    <li ref={row}>
      <a href={`/recipes/${recipe.id}`}>
        <img src={placeholder} alt="" />
        <h2>{recipe.name}</h2>
      </a>
      <RecipeButtons recipe={recipe} open={open} />
    </li>
  );
}

export function Catalogue({ validation = 0 }: { validation?: number }) {
  const [controls, setControls] = useState(restore);
  const [draft, setDraft] = useState(controls.text);
  const [picker, setPicker] = useState(false);
  const add = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [action, setAction] = useState<RecipeAction | null>(null);
  useWriteArrivalFocus(heading);
  useEffect(() => {
    remember(controls);
  }, [controls]);
  useEffect(() => {
    if (draft === controls.text) return;
    const timer = window.setTimeout(
      () => setControls((c) => ({ ...c, text: draft })),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [draft, controls.text]);
  const query = useMemo(() => catalogueQuery(controls), [controls]);
  const results = usePagedSearch(searchRecipes, query, validation);
  return (
    <section className="catalogue">
      <h1 ref={heading} tabIndex={-1}>
        Recettes
      </h1>
      <div className="search-row">
        <div className="search-box">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="m15 15 6 6" />
          </svg>
          <input
            ref={input}
            type="text"
            aria-label="Rechercher une recette"
            placeholder="Rechercher une recette…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draft && (
            <RemoveButton
              label="Effacer la recherche"
              remove={() => {
                setDraft("");
                setControls((c) => ({ ...c, text: "" }));
                input.current?.focus();
              }}
            />
          )}
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.currentTarget.focus();
            setAction({ kind: "create" });
          }}
        >
          + Nouvelle recette
        </button>
      </div>
      <div className="filter-row">
        <button
          type="button"
          ref={add}
          className="outline"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.currentTarget.focus();
            setPicker(true);
          }}
        >
          + Ingrédient
        </button>
        {controls.ingredients.map((i) => (
          <span className="chip" key={i.id}>
            {i.name}
            <RemoveButton
              label={`Retirer ${i.name}`}
              remove={() => {
                setControls((c) => {
                  const ingredients = c.ingredients.filter(
                    (x) => x.id !== i.id,
                  );
                  return {
                    ...c,
                    ingredients,
                    mode: ingredients.length < 2 ? "AND" : c.mode,
                  };
                });
                add.current?.focus();
              }}
            />
          </span>
        ))}
        {controls.ingredients.length > 1 && (
          <fieldset>
            <legend>Ingrédients à inclure</legend>
            {(["AND", "OR"] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="ingredient-mode"
                  checked={controls.mode === mode}
                  onChange={() => setControls((c) => ({ ...c, mode }))}
                />
                {mode === "AND" ? "Tous" : "Au moins un"}
              </label>
            ))}
          </fieldset>
        )}
        <select
          aria-label="Trier les recettes"
          value={controls.sort}
          onChange={(e) =>
            setControls((c) => ({
              ...c,
              sort: e.target.value as Controls["sort"],
            }))
          }
        >
          {Object.entries(sorts).map(([value, [label]]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {picker && (
        <IngredientPicker
          excluded={controls.ingredients}
          close={() => setPicker(false)}
          choose={(i) => {
            setControls((c) => ({ ...c, ingredients: [...c.ingredients, i] }));
            setPicker(false);
          }}
        />
      )}
      <div
        role="status"
        className={results.items.length ? "catalogue-sr-only" : undefined}
      >
        {results.pending && <p>Chargement en cours…</p>}
        {!results.failed && !results.pending && !results.items.length && (
          <p>
            {query.filter
              ? "Aucune recette ne correspond à ces filtres."
              : "Aucune recette."}
          </p>
        )}
      </div>
      {results.failed && (
        <p role="alert">Impossible de charger les recettes.</p>
      )}
      {action && (
        <RecipeDialog
          action={action}
          fallback={input}
          close={() => setAction(null)}
          changed={(saved) => {
            if (action.kind !== "create") {
              results.refresh((rows) =>
                rows.flatMap((row) =>
                  row.id !== action.recipe.id ? [row] : saved ? [saved] : [],
                ),
              );
            }
            setAction(null);
          }}
        />
      )}
      <ul
        ref={list}
        className="recipe-grid"
        aria-label="Résultats des recettes"
      >
        {results.items.map((r) => (
          <RecipeCard key={r.id} recipe={r} open={setAction} fallback={input} />
        ))}
      </ul>
      <PageAction
        results={results}
        query={query}
        list={list}
        fallback={input}
        label="Plus de recettes"
      />
    </section>
  );
}
