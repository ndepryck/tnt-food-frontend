import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dialogKeyboard } from "../../core/dialogKeyboard";
import { RequestError } from "../../core/RequestError";
import { usePagedSearch } from "../../core/search/usePagedSearch";
import { useRead } from "../../core/useRead";
import {
  type Ingredient,
  type IngredientSearch,
  searchIngredients,
} from "./api/ingredients";
import { PageAction } from "./PageAction";

interface PickerProps {
  excluded: Ingredient[];
  choose: (ingredient: Ingredient) => void;
  close: () => void;
  loadExcluded?: (signal: AbortSignal) => Promise<Ingredient[]>;
}

export function IngredientPicker({
  excluded,
  choose,
  close,
  loadExcluded,
}: PickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const opener = document.activeElement;
    node.showModal();
    node.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      node.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      className="ingredient-picker"
      ref={dialog}
      aria-labelledby={title}
      onKeyDown={(event) => dialogKeyboard(event, close)}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2 id={title}>Choisir un ingrédient</h2>
      {loadExcluded ? (
        <MembershipSuggestions load={loadExcluded} choose={choose} />
      ) : (
        <Suggestions excluded={excluded} choose={choose} />
      )}
      <button type="button" className="outline" onClick={close}>
        Fermer
      </button>
    </dialog>
  );
}

function MembershipSuggestions({
  load,
  choose,
}: {
  load: NonNullable<PickerProps["loadExcluded"]>;
  choose: PickerProps["choose"];
}) {
  const { state, retry } = useRead(load);
  if (state.status === "loading")
    return <p role="status">Vérification des ingrédients déjà associés…</p>;
  if (state.status === "error")
    return (
      <RequestError
        message="Impossible de vérifier les ingrédients déjà associés."
        retry={retry}
      />
    );
  return <Suggestions excluded={state.data} choose={choose} />;
}

function Suggestions({
  excluded,
  choose,
}: Pick<PickerProps, "excluded" | "choose">) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // The search field can arrive after the open dialog has checked memberships.
    const field = input.current;
    if (field?.closest("dialog")?.open) field.focus();
  }, []);
  const list = useRef<HTMLUListElement>(null);
  const [text, setText] = useState("");
  const query = useMemo<IngredientSearch>(
    () => ({
      limit: 10,
      filter: text.trim()
        ? { attribute: "name", filterOperator: "CONTAINS", value: text.trim() }
        : undefined,
    }),
    [text],
  );
  const results = usePagedSearch(searchIngredients, query);
  const available =
    results.failed && !results.current
      ? []
      : results.items.filter(
          (i) => !excluded.some((selected) => selected.id === i.id),
        );
  return (
    <>
      <label>
        Rechercher un ingrédient
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="picker-results">
        <div
          role="status"
          className={available.length ? "catalogue-sr-only" : undefined}
        >
          {results.pending && <p>Recherche en cours…</p>}
          {!available.length && !results.pending && !results.failed && (
            <p>Aucun ingrédient disponible sur cette page.</p>
          )}
        </div>
        {results.failed && (
          <p role="alert">Impossible de charger les ingrédients.</p>
        )}
        <ul ref={list} className="suggestions">
          {available.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                disabled={!results.current}
                onClick={() => choose(i)}
              >
                {i.name}
              </button>
            </li>
          ))}
        </ul>
        <PageAction
          results={results}
          query={query}
          list={list}
          fallback={input}
          label="Plus d’ingrédients"
        />
      </div>
    </>
  );
}
