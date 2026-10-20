import type { RecordItem } from "./model.ts";

export type AttendanceSummary = {
  workerId: string;
  checkIns: number;
  checkOuts: number;
  pendingReviews: number;
  acceptedReviews: number;
  rejectedReviews: number;
  lastEventAt: string | null;
};

/** Summarise recorded attendance evidence. Counts are not verified hours or payroll approval. */
export function summariseAttendance(records: readonly RecordItem[], projectId: string): AttendanceSummary[] {
  const workers = new Map<string, AttendanceSummary>();
  for (const record of records) {
    if (record.pid !== projectId || record.kind !== "attendance") continue;
    const data = record.data;
    if (typeof data.workerId !== "string" || !data.workerId.trim()) continue;
    const existing = workers.get(data.workerId) ?? {
      workerId: data.workerId,
      checkIns: 0,
      checkOuts: 0,
      pendingReviews: 0,
      acceptedReviews: 0,
      rejectedReviews: 0,
      lastEventAt: null,
    };
    if (data.event === "in") existing.checkIns++;
    if (data.event === "out") existing.checkOuts++;
    if (data.reviewStatus === "accepted") existing.acceptedReviews++;
    else if (data.reviewStatus === "rejected") existing.rejectedReviews++;
    else existing.pendingReviews++;
    const timestamp = typeof data.serverAt === "string" && Number.isFinite(Date.parse(data.serverAt))
      ? data.serverAt : record.createdAt;
    if (!existing.lastEventAt || timestamp > existing.lastEventAt) existing.lastEventAt = timestamp;
    workers.set(data.workerId, existing);
  }
  return [...workers.values()].sort((a, b) => a.workerId.localeCompare(b.workerId));
}
