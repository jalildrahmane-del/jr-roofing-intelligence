export function readOfflineQueue(raw: string | null): any[] {
  const value = JSON.parse(raw || "[]");
  if (
    !Array.isArray(value) ||
    value.some(
      (e) =>
        !e ||
        e.offline !== true ||
        !["in", "out", "break-start", "break-end"].includes(e.event) ||
        typeof e.requestId !== "string" ||
        !e.requestId ||
        e.requestId.length > 100 ||
        typeof e.capturedAt !== "string" ||
        !Number.isFinite(Date.parse(e.capturedAt)),
    )
  )
    throw Error(
      "Saved offline queue is unreadable. Stored data has been preserved; do not clear browser storage.",
    );
  return value;
}
