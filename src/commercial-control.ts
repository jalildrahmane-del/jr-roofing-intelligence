import type { RecordItem } from "./model.ts";

export type CommercialSummary = {
  approvedBudgetPence: number | null;
  committedPence: number;
  actualPence: number;
  pendingVariationsPence: number;
  acceptedVariationsPence: number;
  forecastPence: number | null;
  forecastVariancePence: number | null;
  unpricedCommitments: number;
  unpricedVariations: number;
  variations: {id:string;reference:string;description:string;status:string;amountPence:number|null;createdAt:string}[];
};

function validMoney(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function commercialSummary(records: RecordItem[]): CommercialSummary {
  const entries = records.filter(r => r.kind.startsWith("commercial."));
  const budget = entries.filter(r => r.kind === "commercial.budget").at(-1);
  const approvedBudgetPence = budget ? validMoney(budget.data.amountPence) : null;
  const costs = entries.filter(r => r.kind === "commercial.cost");
  const committed = costs.filter(r => r.data.costType === "commitment");
  const actual = costs.filter(r => r.data.costType === "actual");
  const sum = (items: RecordItem[]) => items.reduce((n,r) => n + (validMoney(r.data.amountPence) ?? 0), 0);
  const latest = new Map<string,RecordItem>();
  for (const r of entries.filter(r => r.kind === "commercial.variation")) {
    const key = typeof r.data.entityId === "string" && r.data.entityId ? r.data.entityId : r.id;
    latest.set(key,r);
  }
  const variations = [...latest.values()].map(r => ({
    id:r.id,reference:String(r.data.reference||""),description:String(r.data.description||""),
    status:String(r.data.status||"proposed"),amountPence:validMoney(r.data.amountPence),createdAt:r.createdAt,
  }));
  const acceptedVariationsPence = variations.filter(v=>v.status==="accepted").reduce((n,v)=>n+(v.amountPence??0),0);
  const pendingVariationsPence = variations.filter(v=>v.status==="proposed").reduce((n,v)=>n+(v.amountPence??0),0);
  const unpricedVariations = variations.filter(v=>v.status!=="rejected"&&v.amountPence===null).length;
  const unpricedCommitments = committed.filter(r=>validMoney(r.data.amountPence)===null).length;
  // Commitments and actual costs can overlap. Never add them together to claim cost-to-complete.
  // This is a recorded-cost comparison, not an earned-value or final-account forecast.
  const actualPence=sum(actual),committedPence=sum(committed);
  const forecastPence = null,forecastVariancePence = null;
  return {approvedBudgetPence,committedPence,actualPence,pendingVariationsPence,
    acceptedVariationsPence,forecastPence,forecastVariancePence,unpricedCommitments,unpricedVariations,variations};
}
export function formatGBP(pence: number|null): string {
  return pence === null ? "Not established" : new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);
}
