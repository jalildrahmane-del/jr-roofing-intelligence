/** Editable risk assessment authoring aids; never a safety approval or automatic control recommendation. */
export type RiskRow = {
  activity: string;
  hazard: string;
  persons: string;
  likelihood: number;
  severity: number;
  controls: string;
  residualLikelihood: number;
  residualSeverity: number;
  responsible: string;
};
export const riskScore = (likelihood: number, severity: number): number => {
  if (![likelihood,severity].every(v => Number.isInteger(v) && v >= 1 && v <= 5))
    throw Error("Risk likelihood and severity must be integers from 1 to 5");
  return likelihood * severity;
};
export function riskBand(score: number): "Low" | "Medium" | "High" {
  if (!Number.isInteger(score) || score < 1 || score > 25) throw Error("Invalid risk score");
  return score <= 4 ? "Low" : score <= 12 ? "Medium" : "High";
}
export function formatRiskRows(rows: RiskRow[]): string {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 25) throw Error("Add between 1 and 25 risk rows");
  return rows.map((r,i) => {
    for (const key of ["activity","hazard","persons","controls","responsible"] as const)
      if (typeof r[key] !== "string" || !r[key].trim() || r[key].length > 2000)
        throw Error(`Risk row ${i+1}: ${key} is required (maximum 2000 characters)`);
    const initial = riskScore(r.likelihood,r.severity);
    const residual = riskScore(r.residualLikelihood,r.residualSeverity);
    return [
      `ACTIVITY ${i+1}: ${r.activity.trim()}`,
      `Hazard: ${r.hazard.trim()}`,
      `Persons at risk: ${r.persons.trim()}`,
      `Initial risk: L${r.likelihood} x S${r.severity} = ${initial} (${riskBand(initial)})`,
      `Controls / safe system of work: ${r.controls.trim()}`,
      `Residual risk (author assessment): L${r.residualLikelihood} x S${r.residualSeverity} = ${residual} (${riskBand(residual)})`,
      `Responsible person: ${r.responsible.trim()}`,
    ].join("\n");
  }).join("\n\n");
}
export function formatSafetyDraft(type: "RAMS"|"CPP", scope: string, method: string, rows: RiskRow[]): string {
  if (!scope.trim() || !method.trim()) throw Error("Scope and method / arrangements are required");
  if (scope.length > 5000 || method.length > 12000) throw Error("Scope or method is too long");
  const details = formatRiskRows(rows);
  return [
    `${type} — HUMAN-AUTHORED DRAFT FOR INDEPENDENT REVIEW`,
    "Site and task applicability must be confirmed by competent personnel. No permission to work is granted.",
    `\nSCOPE / WORKS\n${scope.trim()}`,
    `\n${type === "CPP" ? "CONSTRUCTION PHASE ARRANGEMENTS" : "METHOD STATEMENT / WORK SEQUENCE"}\n${method.trim()}`,
    `\nACTIVITY HAZARDS, CONTROLS AND 5x5 RISK RATINGS\n${details}`,
    "\nRISK SCALE: likelihood and severity each 1–5; Low 1–4, Medium 5–12, High 13–25. Ratings are author-entered, not AI verified.",
    "\nREVIEW: Competent independent manager must review site-specific controls, emergency arrangements, access and permits before issue.",
  ].join("\n");
}
