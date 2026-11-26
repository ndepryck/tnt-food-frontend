import { Catalogue } from "../modules/recipes/Catalogue";
import { RecipeDetail } from "../modules/recipes/RecipeDetail";
import { MissingPage } from "../core/MissingPage";

export function App() {
  const path = window.location.pathname.replace(/\/$/, "");
  const catalogue = path === "" || path === "/recipes";
  const detail = /^\/recipes\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.exec(path);

  return <>
    <header><nav aria-label="Navigation principale">
      <strong>TNT Food</strong>
      <a href="/recipes" aria-current={catalogue ? "page" : undefined}>Recettes</a>
    </nav></header>
    <main>
      {catalogue ? <Catalogue /> : detail ? <RecipeDetail key={detail[1]} id={detail[1]} /> :
        <MissingPage title={/^\/recipes\/[^/]+$/.test(path) ? "Recette introuvable" : "Page introuvable"} />}
    </main>
  </>;
}
