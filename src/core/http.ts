export function jsonWrite(method: "POST" | "PATCH", body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  const response = await fetch(url, init);
  if (!response.ok) throw new HttpError(response.status);
  return response.status === 204 ? undefined : response.json();
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const data = await request<T>(url, init);
  if (data === undefined) throw new Error("Expected a JSON response");
  return data;
}
