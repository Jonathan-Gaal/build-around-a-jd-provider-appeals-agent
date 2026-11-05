export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: unknown) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit, inspectHeaders?: (headers: Headers) => void): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "request_failed";
    throw new ApiError(response.status, code, error);
  }
  inspectHeaders?.(response.headers);
  return payload as T;
}

export const readApi = <T>(url: string) => request<T>(url);
export async function readApiWithTestLabel<T>(url: string): Promise<{ data: T; isolatedTest: boolean }> {
  let isolatedTest = false;
  const data = await request<T>(url, undefined, headers => { isolatedTest = headers.get("x-ur-e2e-mode") === "fake-clients-isolated-db"; });
  return { data, isolatedTest };
}
export const writeApi = <T>(url: string, method: "POST" | "PATCH", body: unknown) => request<T>(url, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
