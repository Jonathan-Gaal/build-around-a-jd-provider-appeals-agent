export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: unknown) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "request_failed";
    throw new ApiError(response.status, code, error);
  }
  return payload as T;
}

export const readApi = <T>(url: string) => request<T>(url);
export const writeApi = <T>(url: string, method: "POST" | "PATCH", body: unknown) => request<T>(url, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
