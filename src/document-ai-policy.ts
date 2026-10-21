/** Issue #4: fail-closed guard for AI drafting. No network requests or billable calls. */
export type DraftSource = { reference: string; excerpt: string };
export type DraftRequest = { projectId: string; documentType: "RAMS" | "CPP" | "survey" | "specification"; sources: DraftSource[] };
export type DraftReadiness = { allowed: boolean; reasons: string[]; reviewRequired: true; status: "disabled" | "ready-for-human-review-workflow" };

export function assessAiDraftReadiness(request: DraftRequest, settings: { explicitlyApproved: boolean; configuredServerSide: boolean; maxSources?: number }): DraftReadiness {
  const reasons: string[] = [];
  if (!settings.explicitlyApproved) reasons.push("AI drafting has not been explicitly approved by the owner");
  if (!settings.configuredServerSide) reasons.push("Server-side provider is not configured");
  if (!request.projectId || request.projectId.length > 200) reasons.push("Valid project identifier required");
  if (!["RAMS", "CPP", "survey", "specification"].includes(request.documentType)) reasons.push("Unsupported document type");
  if (!Array.isArray(request.sources) || request.sources.length === 0 || request.sources.length > (settings.maxSources ?? 20))
    reasons.push("Source references are required within the configured limit");
  else if (request.sources.some(s => !s || typeof s.reference !== "string" || !s.reference.trim() ||
    s.reference.length > 300 || typeof s.excerpt !== "string" || !s.excerpt.trim() || s.excerpt.length > 10000))
    reasons.push("Every source must include a bounded reference and excerpt");
  return { allowed: reasons.length === 0, reasons, reviewRequired: true,
    status: reasons.length ? "disabled" : "ready-for-human-review-workflow" };
}
