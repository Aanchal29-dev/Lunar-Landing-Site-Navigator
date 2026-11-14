import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly detail?: ApiErrorBody["detail"]) {
    super(message);
  }
}

function errorMessage(detail: ApiErrorBody["detail"]): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" ");
  return "The server could not complete this request.";
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => undefined) as T | ApiErrorBody | undefined;
  if (!response.ok) {
    const detail = (body as ApiErrorBody | undefined)?.detail;
    throw new ApiError(response.status, errorMessage(detail), detail);
  }
  return body as T;
}

export function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(path, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
