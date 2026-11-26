import { useCallback, useRef, useState } from "react";
import { RecipeButtons, RecipeDialog, type RecipeAction } from "./RecipeActions";
import { navigateAfterWrite, useWriteArrivalFocus } from "./writeNavigation";
import placeholder from "../../assets/recipe-placeholder.png";
import { RequestError } from "../../core/RequestError";
import { HttpError } from "../../core/http";
import { useRead } from "../../core/useRead";
import { readRecipe } from "./api";
import { RecipeSteps } from "./RecipeSteps";
import { RecipeIngredients } from "./RecipeIngredients";
import "./detail.css";

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
    {!missing && <div className="recipe-sections"><RecipeIngredients id={id} validation={validation} /><RecipeSteps key={validation} id={id} /></div>}
  </article>;
}
