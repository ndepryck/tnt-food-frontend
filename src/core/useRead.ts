import { useEffect, useState } from "react";

type State<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: unknown };

export function useRead<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ status: "ready", data }); },
      error => { if (!controller.signal.aborted) setState({ status: "error", error }); },
    );
    return () => controller.abort();
  }, [load, attempt]);
  return { state, retry: () => setAttempt(value => value + 1) };
}
