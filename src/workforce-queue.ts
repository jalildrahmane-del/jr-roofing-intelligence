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
  // A duplicate retry ID can silently collapse two separate attendance events on sync.
  // Reject the queue rather than silently dropping evidence or rewriting saved IDs.
  const ids = value.map((e) => e.requestId);
  if (new Set(ids).size !== ids.length)
    throw Error("Saved offline queue contains duplicate event IDs. Stored data has been preserved; do not clear browser storage.");
  return value;
}
