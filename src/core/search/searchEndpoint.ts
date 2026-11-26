import { requestJson } from "../http";
import type { Page, Search } from "./contract";

export function searchEndpoint<T, Q extends Search<string, string, string>>(
  url: string,
) {
  return (query: Q, offset: number, signal: AbortSignal) =>
    requestJson<Page<T>>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...query, offset }),
      signal,
    });
}
