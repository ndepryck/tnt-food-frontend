import { useEffect, useMemo, useRef, useState } from "react";

type State<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; refreshFailed?: boolean }
  | { status: "error"; error: unknown };

export function useRead<T>(
  load: (signal: AbortSignal) => Promise<T>,
  validation = 0,
  discardOn?: (error: unknown) => boolean,
) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  // Retry and validation distinguish requests even when the loader is unchanged.
  const request = useMemo(
    () => ({ load, attempt, validation, discardOn }),
    [load, attempt, validation, discardOn],
  );
  const [settled, setSettled] = useState<typeof request | null>(null);
  const previous = useRef(load);
  useEffect(() => {
    const { load: read, discardOn: mustDiscard } = request;
    const controller = new AbortController();
    active.current = controller;
    const same = previous.current === read;
    previous.current = read;
    setState((old) =>
      same && old.status === "ready"
        ? { ...old, refreshFailed: false }
        : { status: "loading" },
    );
    read(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data });
        setSettled(request);
      },
      (error) => {
        if (controller.signal.aborted) return;
        setState((old) =>
          old.status === "ready" && !mustDiscard?.(error)
            ? { ...old, refreshFailed: true }
            : { status: "error", error },
        );
        setSettled(request);
      },
    );
    return () => controller.abort();
  }, [request]);
  return {
    state,
    pending: settled !== request,
    retry: () => setAttempt((value) => value + 1),
    replace(data: T) {
      active.current?.abort();
      setState({ status: "ready", data });
      setSettled(request);
    },
  };
}
