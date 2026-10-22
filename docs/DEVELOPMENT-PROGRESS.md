# Approved scope progress — 21 October 2026

This checklist distinguishes implemented review-build behaviour from outstanding release criteria. No merge, deployment or paid activation has occurred.

## Source baseline
- Main: db7c059 (Issues 1–3 merged).
- Attendance PR #12: d583c081.
- Document PR #13: b6d60324, stacked on #12.
- This change is a separate draft on top of #13. Do not independently merge stacked branches without reviewing the dependency order.

## Issue 5 acceptance
- [x] Registered company/worker accounts via existing administrative create-user script.
- [x] Project allocations with shift labels and captured hourly rates.
- [x] GPS uncertainty and boundary checks; no continuous tracking.
- [x] Signed short-lived QR bound to worker/project/event, durable atomic redemption and canonical signature checks.
- [x] Check-in/out and breaks, server receipt timestamps and append-only audit.
- [x] Offline events pending independent timestamp verification; idempotent queue sync.
- [x] Independent supervisor review/corrections; workers cannot self-approve.
- [x] Daily progress and weekly quantities remain labelled reported evidence.
- [x] Manager exception list and historical payment comparisons with stale-state detection.
- [x] Verified-hour/payment reconciliation: displayed rounded shift amounts sum exactly to the report total.
- [x] Subcontractor-owner account: manager-granted project access, read-only own-company records and export; exact GPS coordinates withheld; revocation applies on next request.
- [x] Reject impossible calendar dates, missing GPS payloads and conflicting reuse of a submission identifier.
- [ ] Formal privacy/DPIA/lawful basis/worker notice approval before real-person use; gate remains closed.
- [ ] Implement and test retention/pseudonymisation, including audit and backup implications, after policy periods and legal holds are defined.
- [ ] Live camera QR scanning (image import/token fallback already works).
- [ ] Full structured shift scheduling and payroll-system integration (current shift labels and reconciliation do not provide these).

## Issue 4 acceptance
- [x] Human-authored source-linked RAMS/CPP/survey/specification drafts, immutable revisions and exact source excerpts.
- [x] Independent manager review, source-change invalidation and PDF review export.
- [x] SQLite/foreign-key, audit-chain and record-audit integrity checks on startup and backup.
- [x] Worker/viewer/owner restrictions on document intelligence; workforce owner cannot access dossiers, photos or general project records through authenticated APIs.
- [ ] Granular project grants for existing non-workforce staff roles.
- [ ] Rich structured RAMS/CPP authoring and review checklists.
- [ ] Actual AI provider integration, budgets and provider-error tests; no paid API activation is authorised. Existing drafts are expressly not AI output.

## Validation for this change
52 local automated tests passed. TypeScript/build passed. All six browser suites passed; the owner journey was rerun after adding the manager grant UI and passed. Coverage includes desktop/tablet/mobile, company-only downloaded JSON, grant revocation, V3.6 recovery, surveys/tenders, engineering/construction/handover, workforce and documents. PDF output and development proxy/security checks passed. V3.6 byte preservation checks passed. No GitHub CI success is claimed: the existing workflow only automatically validates the historical Issue 3 branch targeting main; other branches do not run its validation job.

## Next implementation work
Continue granular non-workforce project permissions and richer RAMS/CPP structure without enabling AI. Company scope currently uses exact registered company strings; account company changes require controlled administration (there is no self-service company editor). No live-person use is authorised. Retention policy choices must not be invented or implemented by deleting audit records silently.
