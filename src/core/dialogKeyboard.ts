import type { KeyboardEvent } from "react";

/** Keep keyboard navigation inside the active native dialog. */
export function dialogKeyboard(event: KeyboardEvent<HTMLDialogElement>, cancel: () => void) {
  if (event.key === "Escape") { event.preventDefault(); cancel(); return; }
  if (event.key !== "Tab") return;
  const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)");
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
