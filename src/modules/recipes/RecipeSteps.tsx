import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { RequestError } from "../../core/RequestError";
import { useRead } from "../../core/useRead";
import { readSteps, updateRecipeStep, type RecipeStepResponse as Step } from "./api";
import { recipeVisits } from "./recipeHistory";
import { StepDialog, type StepAction } from "./StepDialog";
import { StepList } from "./StepList";

export function RecipeSteps({ id }: { id: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    if (revision && document.activeElement === document.body) heading.current?.focus();
  }, [revision]);
  return <section aria-labelledby="step-heading">
    <h2 id="step-heading" tabIndex={-1} ref={heading}>Préparation</h2>
    <StepEditor key={revision} id={id} heading={heading} changed={() => {
      recipeVisits.written(id);
      setRevision(n => n + 1);
    }} />
  </section>;
}

function StepEditor({ id, heading, changed }: {
  id: string; heading: RefObject<HTMLHeadingElement | null>; changed: () => void;
}) {
  const load = useCallback((signal: AbortSignal) => readSteps(id, signal), [id]);
  const { state, retry } = useRead(load);
  const [action, setAction] = useState<StepAction | null>(null);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState<{ step: Step; position: number } | null>(null);
  async function move(step: Step, position: number) {
    if (moving || action) return;
    setMoving(true);
    setFailed(null);
    heading.current?.focus({ preventScroll: true });
    try {
      await updateRecipeStep(id, step.id, { position });
      changed();
    } catch {
      setFailed({ step, position });
      setMoving(false);
    }
  }
  function open(action: StepAction) {
    setFailed(null);
    setAction(action);
  }
  if (state.status === "loading") return <p role="status">Chargement des étapes…</p>;
  if (state.status === "error") return <RequestError message="Impossible de charger les étapes." retry={() => { heading.current?.focus(); retry(); }} />;
  return <>
    {state.data.length ? <StepList steps={state.data} blocked={moving} move={move}
      edit={step => open({ kind: "edit", step })} remove={step => open({ kind: "delete", step })} /> : <p>Aucune étape.</p>}
    {moving && <p role="status">Déplacement de l’étape…</p>}
    {failed && <RequestError message={`Impossible de déplacer l’étape ${failed.step.position} en position ${failed.position}.`}
      retry={() => move(failed.step, failed.position)} />}
    <button type="button" disabled={moving} aria-haspopup="dialog"
      onClick={e => { e.currentTarget.focus(); open({ kind: "add" }); }}>Ajouter une étape</button>
    {action && <StepDialog id={id} action={action} count={state.data.length} close={() => setAction(null)} changed={changed} fallback={heading} />}
  </>;
}
