import { useCallback, useRef, useState } from "react";
import { RecipeButtons, RecipeDialog, type RecipeAction } from "./RecipeActions";
import { navigateAfterWrite, useWriteArrivalFocus } from "./writeNavigation";
import placeholder from "../../assets/recipe-placeholder.png";
import { RequestError } from "../../core/RequestError";
import { HttpError } from "../../core/http";
import { usePagedSearch } from "../../core/search/usePagedSearch";
import { useRead } from "../../core/useRead";
import { readRecipeIngredients, readRecipe, readSteps } from "./api";
import { PageAction } from "./PageAction";
import "./detail.css";

function Ingredients({ id }: { id: string }) {
  const results = usePagedSearch(readRecipeIngredients, id);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  return <section aria-labelledby="ingredient-heading">
    <h2 id="ingredient-heading" tabIndex={-1} ref={heading}>Ingrédients</h2>
    {results.items.length > 0 && <ul ref={list}>{results.items.map(item =>
      <li key={item.ingredientId} tabIndex={-1}>
        <span>{item.ingredientName}</span><span>{item.quantity}</span>
      </li>)}</ul>}
    {results.pending && <p role="status">Chargement des ingrédients…</p>}
    {results.failed && <p role="alert">Impossible de charger les ingrédients.</p>}
    {results.current && !results.items.length && !results.action && <p>Aucun ingrédient.</p>}
    <PageAction results={results} query={id} list={list} fallback={heading} label="Plus d’ingrédients" />
  </section>;
}

function Preparation({ id }: { id: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback((signal: AbortSignal) => readSteps(id, signal), [id]);
  const { state, retry } = useRead(load);
  return <section aria-labelledby="step-heading">
    <h2 id="step-heading" tabIndex={-1} ref={heading}>Préparation</h2>
    {state.status === "loading" && <p role="status">Chargement des étapes…</p>}
    {state.status === "error" && <RequestError message="Impossible de charger les étapes." retry={() => {
      heading.current?.focus();
      retry();
    }} />}
    {state.status === "ready" && (state.data.length ? <ol>{state.data.map(step =>
      <li key={step.id} value={step.position}>
        <span aria-hidden="true">{step.position}.</span>{step.description}
      </li>)}</ol> : <p>Aucune étape.</p>)}
  </section>;
}

const isMissing = (error: unknown) => error instanceof HttpError && error.status === 404;

export function RecipeDetail({ id, validation = 0 }: { id: string; validation?: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [action, setAction] = useState<RecipeAction | null>(null);
  useWriteArrivalFocus(heading);
  const load = useCallback((signal: AbortSignal) => readRecipe(id, signal), [id]);
  const { state, retry, replace } = useRead(load, validation, isMissing);
  const missing = state.status === "error" && isMissing(state.error);
  // Keep the same heading node through a retry, including a terminal 404.
  // Focus stays there only if the reader has not moved it elsewhere.
  return <article className="recipe-detail">
    {!missing && <div className="detail-tools"><a href="/recipes">← Recettes</a>
      {state.status === "ready" && <RecipeButtons recipe={state.data} open={setAction} />}
    </div>}
    {action && <RecipeDialog action={action} fallback={heading} close={() => setAction(null)} changed={saved => {
      if (!saved) { navigateAfterWrite("/recipes"); return; }
      replace(saved);
      setAction(null);
    }} />}
    <div className={missing ? undefined : "recipe-summary"}>
      <div>
        <h1 ref={heading} tabIndex={-1}>{missing ? "Recette introuvable" : state.status === "ready" ? state.data.name : "Recette"}</h1>
        {missing && <a href="/recipes">Retour au catalogue</a>}
        {state.status === "ready" && <p>{state.data.description}</p>}
        {state.status === "loading" && <p role="status">Chargement de la recette…</p>}
        {((state.status === "error" && !missing) || (state.status === "ready" && state.refreshFailed)) && <RequestError message="Impossible de charger la recette." retry={() => {
          heading.current?.focus();
          retry();
        }} />}
      </div>
      {!missing && <div className="recipe-illustration"><img src={placeholder} alt="" /></div>}
    </div>
    {!missing && <div className="recipe-sections"><Ingredients id={id} /><Preparation id={id} /></div>}
  </article>;
}
