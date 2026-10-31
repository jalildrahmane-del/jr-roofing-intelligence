import type { RecordItem } from "../src/model.ts";
import { latestShifts } from "./workforce-shifts.ts";
// Conservative diagnostic only: ambiguous overlaps are never assigned automatically.
export function matchSchedules(records: RecordItem[], report: any[]) {
  const plans = latestShifts(records).filter((r) => !r.data.cancelled);
  const actual = report.flatMap((r) =>
    r.shifts.map((s: any) => ({ ...s, workerId: r.workerId })),
  );
  const overlaps = (p: RecordItem, a: any) =>
    p.data.workerId === a.workerId &&
    Date.parse(a.start) < Date.parse(p.data.end) &&
    Date.parse(a.end) > Date.parse(p.data.start);
  return plans.map((p) => {
    const candidates = actual.filter((a) => overlaps(p, a));
    const unique =
      candidates.length === 1 &&
      plans.filter((other) => overlaps(other, candidates[0])).length === 1;
    const plannedHours =
      (Date.parse(p.data.end) - Date.parse(p.data.start)) / 3600000 -
      p.data.breakMinutes / 60;
    return {
      revisionId: p.id,
      workerId: p.data.workerId,
      plannedHours,
      status: unique
        ? "Unique verified overlap"
        : candidates.length
          ? "Ambiguous — review required"
          : "No verified completed overlap",
      verifiedHours: unique ? candidates[0].hours : null,
      varianceHours: unique ? candidates[0].hours - plannedHours : null,
      notice:
        "Time overlap only; not proof of scheduled work or payment approval",
    };
  });
}
