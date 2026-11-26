import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Page } from "./contract";

// A new query replaces the page chain. Keep the last successful rows readable
// until its first page arrives; never append across queries or after unmount.
export function usePagedSearch<T, Q>(
  fetchPage: (query: Q, offset: number, signal: AbortSignal) => Promise<Page<T>>,
  query: Q,
) {
  const active = useRef<AbortController | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<Q>();
  const [next, setNext] = useState<number | null>(null);
  const [failedOffset, setFailedOffset] = useState<number | null>(null);
  const [pending, setPending] = useState(true);
  const request = useCallback(async (offset: number) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setFailedOffset(null);
    if (!offset) setNext(null);
    try {
      const page = await fetchPage(query, offset, controller.signal);
      if (controller.signal.aborted) return;
      setItems(old => offset ? [...old, ...page.items] : page.items);
      setLoadedQuery(query);
      setNext(page.hasMore ? page.nextOffset : null);
    } catch {
      if (!controller.signal.aborted) setFailedOffset(offset);
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [fetchPage, query]);
  useLayoutEffect(() => {
    void request(0);
    return () => active.current?.abort();
  }, [request]);
  return {
    items, current: loadedQuery === query, pending, failed: failedOffset !== null,
    continuation: (failedOffset ?? next ?? 0) > 0,
    action: failedOffset !== null ? () => request(failedOffset)
      : next !== null && loadedQuery === query ? () => request(next) : null,
  };
}
