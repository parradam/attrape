// ApiError carries the server's message, e.g. "title is required".
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// request sends a JSON request to the API and decodes the response.
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? "something went wrong", res.status);
  }
  return data as T;
}

// errorMessage turns an error into a sentence for display.
export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.charAt(0).toUpperCase() + msg.slice(1) + ".";
}
