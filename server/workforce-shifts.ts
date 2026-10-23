import type { RecordItem } from "../src/model.ts";
export function latestShifts(records: RecordItem[]) {
  const latest = new Map<string, RecordItem>();
  for (const r of records.filter((r) => r.kind === "workforce.shift"))
    latest.set(r.data.shiftId || r.id, r);
  return [...latest.values()];
}
export function shiftTime(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    throw Error("Shift time requires ISO date/time with timezone");
  const day = new Date(value.slice(0, 10) + "T00:00:00Z");
  if (
    !Number.isFinite(+day) ||
    day.toISOString().slice(0, 10) !== value.slice(0, 10) ||
    !Number.isFinite(Date.parse(value)) ||
    Number(value.slice(11, 13)) > 23
  )
    throw Error("Invalid shift date/time");
  return new Date(value).toISOString();
}
