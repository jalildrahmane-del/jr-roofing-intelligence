import type { RecordItem } from "./model.ts";
import { current } from "./tender.ts";
import { constructionBlockers, recordedStageRelease } from "./gates.ts";

export type ProgrammeTask = {
  id: string;
  title: string;
  progress: number | null;
  baselineEnd: string;
  plannedEnd: string;
  actualEnd: string;
  overdue: boolean;
  baselineSlippageDays: number | null;
};
const validDay = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0,10) === value ? value : "";
};
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
export function constructionOverview(records: RecordItem[], today: string) {
  if (!validDay(today)) throw Error("A valid reporting date is required");
  const tasks: ProgrammeTask[] = current(records, "programme").map(r => {
    const raw = Number(r.data.progress);
    const progress = r.data.progress !== "" && r.data.progress != null && Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : null;
    const plannedEnd = validDay(r.data.plannedEnd);
    const baselineEnd = validDay(r.data.baselineEnd);
    const actualEnd = validDay(r.data.actualEnd);
    return {
      id: r.id, title: String(r.data.title || "Untitled task"), progress,
      plannedEnd, baselineEnd, actualEnd,
      overdue: !!plannedEnd && plannedEnd < today && !actualEnd && progress !== 100,
      baselineSlippageDays: plannedEnd && baselineEnd ? daysBetween(baselineEnd, plannedEnd) : null,
    };
  });
  const diaries = current(records, "diary").sort((a,b) => String(b.data.date || "").localeCompare(String(a.data.date || "")));
  const controls = current(records, "control");
  const blockers = constructionBlockers(records, "prestart");
  return {
    tasks, diaries, controls, blockers,
    overdueTasks: tasks.filter(t => t.overdue).length,
    tasksCompleted: tasks.filter(t => t.progress === 100).length,
    averageProgress: tasks.length && tasks.every(t => t.progress !== null) ? Math.round(tasks.reduce((s,t) => s + t.progress!,0)/tasks.length) : null,
    prestartReleaseRecorded: !!recordedStageRelease(records, "prestart"),
  };
}
