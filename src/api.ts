export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(path: string, data?: unknown) {
  const response = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response. Please retry.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(body.error || "Request failed", response.status);
  return body;
}
