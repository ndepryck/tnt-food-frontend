import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RequestError } from "../../../../core/RequestError";
import { useRead } from "../../../../core/useRead";
import {
  readSteps,
  type RecipeStepResponse as Step,
  updateRecipeStep,
} from "../../api/recipeSteps";
import { recipeVisits } from "../../navigation/recipeHistory";
import { type StepAction, StepDialog } from "./StepDialog";
import { StepList } from "./StepList";
import "./steps.css";

const readFeedbackDelay = 200;

export function RecipeSteps({ id }: { id: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section className="recipe-steps" aria-labelledby="step-heading">
      <h2 id="step-heading" tabIndex={-1} ref={heading}>
        Préparation
      </h2>
      <StepEditor key={id} id={id} heading={heading} />
    </section>
  );
}

function StepEditor({
  id,
  heading,
}: {
  id: string;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const load = useCallback(
    (signal: AbortSignal) => readSteps(id, signal),
    [id],
  );
  const { state, pending, retry } = useRead(load);
  const [showReadStatus, setShowReadStatus] = useState(false);
  useEffect(() => {
    if (!pending) {
      setShowReadStatus(false);
      return;
    }
    const timer = window.setTimeout(
      () => setShowReadStatus(true),
      readFeedbackDelay,
    );
    return () => window.clearTimeout(timer);
  }, [pending]);

  const steps = state.status === "ready" ? state.data : undefined;
  const readFailed =
    !pending &&
    (state.status === "error" ||
      (state.status === "ready" && state.refreshFailed === true));
  const [action, setAction] = useState<StepAction | null>(null);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState<{ step: Step; position: number } | null>(
    null,
  );
  const blocked = pending || readFailed || moving;
  function changed() {
    recipeVisits.written(id);
    retry();
    setAction(null);
    setMoving(false);
  }

  async function move(step: Step, position: number) {
    if (blocked || action) return;
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
    if (blocked) return;
    setFailed(null);
    setAction(action);
  }
  return (
    <>
      {steps && (
        <>
          {steps.length ? (
            <StepList
              steps={steps}
              blocked={blocked || action !== null}
              fallback={heading}
              move={move}
              edit={(step) => open({ kind: "edit", step })}
              remove={(step) => open({ kind: "delete", step })}
            />
          ) : (
            <p>Aucune étape.</p>
          )}
          {moving && <p role="status">Déplacement de l’étape…</p>}
          {failed && (
            <RequestError
              message={`Impossible de déplacer l’étape ${failed.step.position} en position ${failed.position}.`}
              retry={() => move(failed.step, failed.position)}
            />
          )}
          <button
            type="button"
            aria-disabled={blocked || undefined}
            aria-haspopup="dialog"
            onClick={(e) => {
              if (blocked) return;
              e.currentTarget.focus();
              open({ kind: "add" });
            }}
          >
            Ajouter une étape
          </button>
        </>
      )}
      <p className="step-read-status" role="status">
        {pending &&
          showReadStatus &&
          (steps ? "Actualisation des étapes…" : "Chargement des étapes…")}
      </p>
      {readFailed && (
        <RequestError
          message={
            steps
              ? "Impossible d’actualiser les étapes."
              : "Impossible de charger les étapes."
          }
          retry={() => {
            heading.current?.focus({ preventScroll: true });
            retry();
          }}
        />
      )}
      {steps && action && (
        <StepDialog
          id={id}
          action={action}
          count={steps.length}
          close={() => setAction(null)}
          changed={changed}
          fallback={heading}
        />
      )}
    </>
  );
}
