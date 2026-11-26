import { jsonWrite, request, requestJson } from "../../../core/http";
import { recipeUrl } from "./routes";

export interface RecipeStepResponse { id: string; recipeId: string; position: number; description: string }
type StepFields = Pick<RecipeStepResponse, "description"> & { position?: number };

const stepsUrl = (id: string) => `${recipeUrl(id)}/steps`;

export function createRecipeStep(id: string, fields: StepFields) {
  return requestJson<RecipeStepResponse>(stepsUrl(id), jsonWrite("POST", fields));
}
export function updateRecipeStep(id: string, stepId: string, fields: Partial<StepFields>) {
  return requestJson<RecipeStepResponse>(`${stepsUrl(id)}/${encodeURIComponent(stepId)}`, jsonWrite("PATCH", fields));
}
export async function deleteRecipeStep(id: string, stepId: string) {
  await request(`${stepsUrl(id)}/${encodeURIComponent(stepId)}`, { method: "DELETE" });
}
export async function readSteps(id: string, signal: AbortSignal) {
  const steps = await requestJson<RecipeStepResponse[]>(stepsUrl(id), { signal });
  return steps.sort((a, b) => a.position - b.position);
}
