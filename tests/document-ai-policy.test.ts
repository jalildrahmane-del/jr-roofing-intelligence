import test from "node:test";
import assert from "node:assert/strict";
import { assessAiDraftReadiness } from "../src/document-ai-policy.ts";
const request = { projectId: "project-1", documentType: "RAMS" as const,
  sources: [{ reference: "drawing-A", excerpt: "Fictional drawing note" }] };
test("AI remains disabled without explicit approval and server configuration", () => {
  const result = assessAiDraftReadiness(request, { explicitlyApproved: false, configuredServerSide: false });
  assert.equal(result.allowed, false);
  assert.equal(result.reviewRequired, true);
  assert.equal(result.reasons.length, 2);
});
test("source-less or invalid draft request fails closed", () => {
  assert.equal(assessAiDraftReadiness({ ...request, sources: [] }, { explicitlyApproved: true, configuredServerSide: true }).allowed, false);
  assert.equal(assessAiDraftReadiness({ ...request, sources: [{ reference: "", excerpt: "text" }] }, { explicitlyApproved: true, configuredServerSide: true }).allowed, false);
});
test("even approved requests require a human review workflow", () => {
  const result = assessAiDraftReadiness(request, { explicitlyApproved: true, configuredServerSide: true });
  assert.equal(result.allowed, true);
  assert.equal(result.reviewRequired, true);
  assert.equal(result.status, "ready-for-human-review-workflow");
});
