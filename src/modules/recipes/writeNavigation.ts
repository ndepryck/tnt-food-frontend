import { useLayoutEffect, type RefObject } from "react";
import { recipeVisits } from "./recipeHistory";

// A normal document navigation preserves history. Only move focus when the
// navigation completed a write, not on ordinary visits or browser Back.
const key = "recipes:write-destination";
export function navigateAfterWrite(path: string) {
  recipeVisits.leavingAfterWrite();
  try { sessionStorage.setItem(key, path); } catch { /* Focus hint is optional. */ }
  window.location.assign(path);
}
export function useWriteArrivalFocus(target: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(key) !== location.pathname) return;
      sessionStorage.removeItem(key);
      if (document.activeElement === document.body) target.current?.focus();
    } catch { /* Storage may be unavailable. */ }
  }, [target]);
}
