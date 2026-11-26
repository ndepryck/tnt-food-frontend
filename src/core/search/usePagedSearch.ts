import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Page } from "./contract";

// A new query replaces the page chain. Keep the last successful rows readable
// until its first page arrives; never append across queries or after unmount.
export function usePagedSearch<T, Q>(
  fetchPage: (query: Q, offset: number, signal: AbortSignal) => Promise<Page<T>>,
  query: Q,
  validation = 0,
) {
  const active = useRef<AbortController | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<Q>();
  const [next, setNext] = useState<number | null>(null);
  const [failed, setFailed] = useState<{ offset: number; count: number } | null>(null);
  const depth = useRef(0);
  const [pending, setPending] = useState(true);
  const [revision, setRevision] = useState(0);
  const request = useCallback(async (offset: number, count = 1) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setFailed(null);
    try {
      // Rebuild the visible page chain atomically. Never splice a new
      // first page onto old offsets, even if a later read fails.
      const rows: T[] = [];
      let cursor: number | null = offset;
      let pages = 0;
      do {
        const page: Page<T> = await fetchPage(query, cursor, controller.signal);
        if (controller.signal.aborted) return;
        rows.push(...page.items);
        cursor = page.hasMore ? page.nextOffset : null;
        pages++;
      } while (cursor !== null && pages < count);
      depth.current = offset ? depth.current + pages : pages;
      setItems(old => offset ? [...old, ...rows] : rows);
      setLoadedQuery(query);
      setNext(cursor);
    } catch {
      if (!controller.signal.aborted) setFailed({ offset, count });
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [fetchPage, query]);
  const previousValidation = useRef(validation);
  useLayoutEffect(() => {
    const verifying = validation !== previousValidation.current;
    previousValidation.current = validation;
    if (!verifying) {
      depth.current = 0;
      setNext(null);
    }
    void request(0, verifying ? Math.max(1, depth.current) : 1);
    return () => active.current?.abort();
  }, [request, revision, validation]);
  return {
    items, current: loadedQuery === query, pending, failed: failed !== null,
    refresh(reconcile: (rows: T[]) => T[]) {
      setItems(reconcile);
      setRevision(n => n + 1);
    },
    continuation: (failed?.offset ?? next ?? 0) > 0,
    action: failed ? () => request(failed.offset, failed.count)
      : next !== null && loadedQuery === query ? () => request(next) : null,
  };
}
