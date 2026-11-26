import { useLayoutEffect, useState } from "react";
import { MissingPage } from "../core/MissingPage";
import { Catalogue } from "../modules/recipes/components/catalogue/Catalogue";
import { RecipeDetail } from "../modules/recipes/components/recipe/RecipeDetail";
import { recipeVisits } from "../modules/recipes/navigation/recipeHistory";

export function App() {
  const [visit, setVisit] = useState(0);
  const [validation, setValidation] = useState(0);
  const path = window.location.pathname.replace(/\/$/, "");
  const catalogue = path === "" || path === "/recipes";
  const detail =
    /^\/recipes\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.exec(path);
  const detailId = detail?.[1];
  useLayoutEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const freshness = recipeVisits.restore(detailId);
      if (freshness === "changed") setVisit((n) => n + 1);
      if (freshness === "unknown") setValidation((n) => n + 1);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [detailId]);

  return (
    <>
      <header>
        <nav aria-label="Navigation principale">
          <strong>TNT Food</strong>
          <a href="/recipes" aria-current={catalogue ? "page" : undefined}>
            Recettes
          </a>
        </nav>
      </header>
      <main key={visit}>
        {catalogue ? (
          <Catalogue validation={validation} />
        ) : detail ? (
          <RecipeDetail
            key={detail[1]}
            id={detail[1]}
            validation={validation}
          />
        ) : (
          <MissingPage
            title={
              /^\/recipes\/[^/]+$/.test(path)
                ? "Recette introuvable"
                : "Page introuvable"
            }
          />
        )}
      </main>
    </>
  );
}
