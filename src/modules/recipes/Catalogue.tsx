import { RequestError } from "../../core/RequestError";
import { useRead } from "../../core/useRead";
import { listRecipes } from "./api";

export function Catalogue() {
  const { state, retry } = useRead(listRecipes);
  return <>
    <h1>Recettes</h1>
    {state.status === "loading" && <p role="status">Chargement des recettes…</p>}
    {state.status === "error" && <RequestError message="Impossible de charger les recettes." retry={retry} />}
    {state.status === "ready" && (state.data.length === 0 ? <p>Aucune recette.</p> :
      <ul>{state.data.map(recipe => <li key={recipe.id}><a href={`/recipes/${recipe.id}`}>{recipe.name}</a></li>)}</ul>)}
  </>;
}
