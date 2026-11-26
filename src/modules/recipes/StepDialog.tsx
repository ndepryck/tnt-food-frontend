import { useState, type RefObject } from "react";
import { WriteDialog } from "../../core/WriteDialog";
import { createRecipeStep, deleteRecipeStep, updateRecipeStep, type RecipeStepResponse as Step } from "./api/recipeSteps";

export type StepAction = { kind: "add" } | { kind: "edit" | "delete"; step: Step };

export function StepDialog({ id, action, count, close, changed, fallback }: {
  id: string; action: StepAction; count: number; close: () => void; changed: () => void;
  fallback: RefObject<HTMLHeadingElement | null>;
}) {
  const original = action.kind !== "add" ? action.step : undefined;
  const [description, setDescription] = useState(original?.description ?? "");
  const [position, setPosition] = useState(original?.position.toString() ?? "");
  if (action.kind === "delete") return <WriteDialog title={`Supprimer l’étape ${action.step.position} ?`}
    confirmation={`Supprimer l’instruction « ${action.step.description} » ?`} submitLabel="Supprimer"
    failure="Impossible de supprimer cette étape." fallback={fallback} close={close}
    write={async () => { await deleteRecipeStep(id, action.step.id); changed(); }} />;

  const max = count + (original ? 0 : 1);
  const invalid = position === "" ? !!original : !Number.isInteger(+position) || +position < 1 || +position > max;
  return <WriteDialog title={original ? `Modifier l’étape ${original.position}` : "Ajouter une étape"}
    submitLabel={original ? "Enregistrer" : "Ajouter"} failure="Impossible d’enregistrer cette étape."
    close={close} fallback={fallback} fields={busy => <>
      <label>Instruction<textarea data-initial-focus required readOnly={busy} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label>{original ? "Position" : "Position (facultative)"}<input type="number" min={1} max={max} step={1} required={!!original}
        aria-invalid={invalid} readOnly={busy} value={position} onChange={e => setPosition(e.target.value)} /></label>
      {invalid && <p role="alert">Saisissez une position entière entre 1 et {max}.</p>}
    </>}
    write={async () => {
      if (!original) await createRecipeStep(id, { description, ...(position && { position: +position }) });
      else {
        const fields = { ...(description !== original.description && { description }),
          ...(+position !== original.position && { position: +position }) };
        if (!Object.keys(fields).length) { close(); return; }
        await updateRecipeStep(id, original.id, fields);
      }
      changed();
    }} />;
}
