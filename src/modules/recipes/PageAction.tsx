import { useLayoutEffect, useRef, useState, type RefObject } from "react";

interface Props {
  results: { pending: boolean; failed: boolean; continuation: boolean; action: (() => Promise<void>) | null };
  query: object;
  list: RefObject<HTMLUListElement | null>;
  fallback: RefObject<HTMLElement | null>;
  label: string;
}

// Keep a single focusable DOM node for more/loading/retry, even on the
// final page. Only transfer focus if it is still there after the DOM update.
export function PageAction({ results, query, list, fallback, label }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const [intent, setIntent] = useState<{ query: Props["query"]; index: number } | null>(null);
  useLayoutEffect(() => {
    if (!intent || results.pending) return;
    if (intent.query === query && !results.failed && document.activeElement === button.current) {
      const row = list.current?.children[intent.index] as HTMLElement | undefined;
      const appended = row?.querySelector<HTMLElement>("a, button");
      // A page of entirely excluded ingredients can have no focusable results.
      if (appended) appended.focus();
      else if (!results.action) fallback.current?.focus();
    }
    setIntent(null);
  }, [intent, query, results, list, fallback]);

  if (!results.action && intent?.query !== query) return null;
  return <button ref={button} aria-disabled={results.pending} onClick={() => {
    if (results.pending || !results.action) return;
    setIntent({ query, index: results.continuation ? list.current?.children.length ?? 0 : 0 });
    void results.action();
  }}>{results.failed ? "Réessayer" : results.pending ? "Chargement…" : label}</button>;
}
