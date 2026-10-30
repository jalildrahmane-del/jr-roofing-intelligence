import type { RecordItem } from "./model.ts";
import { estimateWarnings } from "./tender.ts";

export type TenderComparisonRow = {
  id: string;
  title: string;
  version: number;
  netPence: number | null;
  grossPence: number | null;
  directPence: number | null;
  profitPence: number | null;
  complete: boolean;
  warnings: string[];
  comparable: boolean;
  lowestCurrentNet: boolean;
};

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Read-only comparison of current tender options; never treats unpriced/stale estimates as zero. */
export function compareTenderOptions(
  estimates: RecordItem[],
  roofs: RecordItem[],
  materials: RecordItem[],
): TenderComparisonRow[] {
  const rows = estimates.map((estimate): TenderComparisonRow => {
    const p = estimate.data.pricing || {};
    const warnings = estimateWarnings(estimate, roofs, materials);
    const netPence = amount(p.netPence);
    const grossPence = amount(p.grossPence);
    const directPence = amount(p.directPence);
    const profitPence = amount(p.profitPence);
    const complete = p.complete === true;
    return {
      id: estimate.id,
      title: String(estimate.data.title || "Untitled option"),
      version: Number(estimate.data.version || 1),
      netPence,
      grossPence,
      directPence,
      profitPence,
      complete,
      warnings,
      comparable: complete && warnings.length === 0 && netPence !== null && grossPence !== null,
      lowestCurrentNet: false,
    };
  });
  const comparable = rows.filter(r => r.comparable);
  if (comparable.length < 2) return rows;
  const lowest = Math.min(...comparable.map(r => r.netPence!));
  return rows.map(r => ({ ...r, lowestCurrentNet: r.comparable && r.netPence === lowest }));
}
