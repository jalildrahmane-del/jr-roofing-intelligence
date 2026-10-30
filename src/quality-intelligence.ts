import type { RecordItem } from "./model.ts";
import { current } from "./tender.ts";
import { closeoutBlockers, handoverKey, reviewFor, recordedStageRelease } from "./gates.ts";

export type InspectionStatus = "accepted" | "pending" | "failed" | "information-required";
export type QualityRow = {
  id: string;
  title: string;
  kind: "holdpoint" | "snag" | "handoverItem";
  category: string;
  status: InspectionStatus;
  reviewer: string | null;
  evidence: string;
  due: string;
};
export function qualityHandoverOverview(records: RecordItem[], today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(today))) throw Error("Invalid report date");
  const rows: QualityRow[] = (["holdpoint","snag","handoverItem"] as const).flatMap(kind =>
    current(records,kind).map(item => {
      const review = records.filter(r=>r.kind==="gateReview" && r.data.targetId===item.id).at(-1);
      const accepted = reviewFor(records,item);
      const status:InspectionStatus = accepted ? "accepted" :
        review?.data.decision==="failed" ? "failed" :
        review?.data.decision==="information-required" ? "information-required" : "pending";
      return {
        id:item.id,title:String(item.data.title||"Untitled"),kind,
        category:String(item.data.category||item.data.stage||""),
        status,reviewer:accepted?.author||null,
        evidence:String(item.data.evidence||item.data.source||""),
        due:String(item.data.due||""),
      };
    })
  );
  const snags=rows.filter(r=>r.kind==="snag");
  const handoverItems=rows.filter(r=>r.kind==="handoverItem");
  const requiredCategories=["O&M","as-built","warranty","test-certificate","maintenance"];
  const missingCategories=requiredCategories.filter(c=>!handoverItems.some(r=>r.category===c));
  const blockers=closeoutBlockers(records);
  const acceptance=records.filter(r=>r.kind==="handoverAcceptance"&&r.data.packageKey===handoverKey(records)).at(-1);
  return {
    rows,
    inspections:rows.filter(r=>r.kind==="holdpoint"),
    snags,
    handoverItems,
    missingCategories,
    blockers,
    overdueSnags:snags.filter(r=>r.due&&r.due<today&&r.status!=="accepted"),
    outstandingSnags:snags.filter(r=>r.status!=="accepted"),
    acceptedInspections:rows.filter(r=>r.kind==="holdpoint"&&r.status==="accepted").length,
    releases:["prestart","installation","final"].map(stage=>({stage,recorded:!!recordedStageRelease(records,stage)})),
    handoverAcceptanceRecorded:!!acceptance && blockers.length===0,
  };
}
