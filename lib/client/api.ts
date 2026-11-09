import type { DemoMethod, DemoResult, DemoSource } from "./demo-source";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: unknown) {
    super(code);
  }
}

// Set only by the /demo player. Every screen reads and writes through this module, so demo mode swaps one seam.
let demoSource: DemoSource | null = null;
export function setDemoSource(source: DemoSource | null) { demoSource = source; }
export const demoActive = () => demoSource !== null;

function toResult<T>(status: number, payload: unknown): T {
  if (status < 200 || status >= 300) {
    const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "request_failed";
    throw new ApiError(status, code, error);
  }
  return payload as T;
}

async function request<T>(url: string, init?: RequestInit, inspectHeaders?: (headers: Headers) => void): Promise<T> {
  const real = async (): Promise<DemoResult> => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
    const payload: unknown = await response.json();
    if (response.ok) inspectHeaders?.(response.headers);
    return { status: response.status, payload };
  };
  const { status, payload } = demoSource ? await demoSource.handle((init?.method ?? "GET") as DemoMethod, url, real) : await real();
  return toResult<T>(status, payload);
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
