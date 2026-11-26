import { useLayoutEffect, useId, useMemo, useRef, useState } from "react";
import { searchIngredients, type Ingredient, type IngredientSearch } from "./api";
import { usePagedSearch } from "../../core/search/usePagedSearch";
import { PageAction } from "./PageAction";

export function IngredientPicker({ excluded, choose, close }: {
  excluded: Ingredient[];
  choose: (ingredient: Ingredient) => void;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const title = useId();
  const [text, setText] = useState("");
  const query = useMemo<IngredientSearch>(() => ({
    limit: 10,
    filter: text.trim() ? { attribute: "name", filterOperator: "CONTAINS", value: text.trim() } : undefined,
  }), [text]);
  const results = usePagedSearch(searchIngredients, query);
  const available = results.failed && !results.current ? [] :
    results.items.filter(i => !excluded.some(selected => selected.id === i.id));
  useLayoutEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog className="ingredient-picker" ref={dialog} aria-labelledby={title} onCancel={e => { e.preventDefault(); close(); }}>
    <h2 id={title}>Choisir un ingrédient</h2>
    <label>Rechercher un ingrédient
      <input ref={input} autoFocus value={text} onChange={e => setText(e.target.value)} />
    </label>
    <div className="picker-results">
      <div role="status" className={available.length ? "catalogue-sr-only" : undefined}>
        {results.pending && <p>Recherche en cours…</p>}
        {!available.length && !results.pending && !results.failed && <p>Aucun ingrédient disponible sur cette page.</p>}
      </div>
      {results.failed && <p role="alert">Impossible de charger les ingrédients.</p>}
      <ul ref={list} className="suggestions">{available.map(i =>
        <li key={i.id}><button disabled={!results.current} onClick={() => choose(i)}>{i.name}</button></li>
      )}</ul>
      <PageAction results={results} query={query} list={list} fallback={input} label="Plus d’ingrédients" />
    </div>
    <button className="outline" onClick={close}>Fermer</button>
  </dialog>;
}
