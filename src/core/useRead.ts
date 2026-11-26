import { useEffect, useRef, useState } from "react";

type State<T> = { status: "loading" } | { status: "ready"; data: T; refreshFailed?: boolean } | { status: "error"; error: unknown };

export function useRead<T>(load: (signal: AbortSignal) => Promise<T>, validation = 0, discardOn?: (error: unknown) => boolean) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  const previous = useRef(load);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    const same = previous.current === load;
    previous.current = load;
    setState(old => same && old.status === "ready" ? { ...old, refreshFailed: false } : { status: "loading" });
    load(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ status: "ready", data }); },
      error => {
        if (!controller.signal.aborted) setState(old => old.status === "ready" && !discardOn?.(error)
          ? { ...old, refreshFailed: true } : { status: "error", error });
      },
    );
    return () => controller.abort();
  }, [load, attempt, validation, discardOn]);
  return { state, retry: () => setAttempt(value => value + 1), replace(data: T) {
    active.current?.abort();
    setState({ status: "ready", data });
  } };
}
