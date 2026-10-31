// Versioned application review prompts, not a safety standard or professional certification.
export const DOCUMENT_CHECKLIST_VERSION = 1;
const common = [
  { id: "scope", label: "Scope and site applicability checked" },
  { id: "sources", label: "Current source revisions and exact excerpts checked" },
  { id: "content", label: "Proposed content checked against cited evidence" },
  { id: "limitations", label: "Evidence gaps, assumptions and exclusions assessed" },
] as const;
const safety = [
  { id: "risks", label: "Hazards, persons at risk, ratings, controls and responsibilities reviewed" },
  { id: "arrangements", label: "Access, emergency arrangements, coordination and applicable permits reviewed" },
] as const;
export function documentReviewItems(type: string) {
  if (!["RAMS", "CPP", "survey", "specification"].includes(type)) throw Error("Unsupported review document type");
  return type === "RAMS" || type === "CPP" ? [...common, ...safety] : [...common];
}
export function reviewChecklistComplete(type: string, version: unknown, checks: unknown): boolean {
  if (version !== DOCUMENT_CHECKLIST_VERSION || !checks || typeof checks !== "object" || Array.isArray(checks)) return false;
  const items = documentReviewItems(type), values = checks as Record<string, unknown>;
  return Object.keys(values).length === items.length && items.every(item => values[item.id] === true);
}
export function validateDocumentChecklist(type: string, decision: string, version: unknown, checks: unknown) {
  const items = documentReviewItems(type);
  if ((version !== undefined && version !== DOCUMENT_CHECKLIST_VERSION) ||
      (decision === "accepted" && version !== DOCUMENT_CHECKLIST_VERSION))
    throw Error("Current document checklist version required");
  const values = checks === undefined && decision === "rejected" ? {} : checks;
  if (!values || typeof values !== "object" || Array.isArray(values)) throw Error("Document review checklist required");
  const input = values as Record<string, unknown>;
  if (Object.keys(input).some(key => !items.some(item => item.id === key) || typeof input[key] !== "boolean"))
    throw Error("Invalid document checklist item or confirmation");
  if (decision === "accepted" && !reviewChecklistComplete(type, version, input))
    throw Error("Complete every document review checklist item before accepting");
  return {
    checklistVersion: DOCUMENT_CHECKLIST_VERSION,
    checks: Object.fromEntries(items.map(item => [item.id, input[item.id] === true])),
    checklistItems: items.map(item => ({ ...item, confirmed: input[item.id] === true })),
  };
}
