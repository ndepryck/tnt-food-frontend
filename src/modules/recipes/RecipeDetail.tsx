import { useCallback } from "react";
import { MissingPage } from "../../core/MissingPage";
import { RequestError } from "../../core/RequestError";
import { HttpError } from "../../core/http";
import { useRead } from "../../core/useRead";
import { readRecipe } from "./api";

export function RecipeDetail({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => readRecipe(id, signal), [id]);
  const { state, retry } = useRead(load);
  if (state.status === "loading") return <p role="status">Chargement de la recette…</p>;
  if (state.status === "error") {
    if (state.error instanceof HttpError && state.error.status === 404) return <MissingPage title="Recette introuvable" />;
    return <RequestError message="Impossible de charger la recette." retry={retry} />;
  }
  return <><h1>{state.data.name}</h1><p>{state.data.description}</p></>;
}
