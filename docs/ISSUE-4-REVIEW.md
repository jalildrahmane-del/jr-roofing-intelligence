# Issue 4 source-linked documents and reliability

> Historical implementation-stage report. The foundation described here is now merged through PR #19; some remaining-work statements below reflect the earlier branch. Use [current integration status](INTEGRATION-PROGRESS.md) and the [Step 6 report](STEP-6-DOCUMENT-REVIEW.md) for current scope.

Stacked on the attendance PR to test the combined application. Neither PR is merged.

Implemented: server-enforced human-authored RAMS/CPP/survey/specification drafting; exact source excerpts with immutable snapshots and SHA-256 provenance; separate proposals and evidence gaps; source and document revision history; independent manager review; source changes invalidate status dynamically; authenticated PDF export; responsive document UI. Worker/viewer accounts cannot use document intelligence. Existing engineering gates remain untouched.

AI status: deliberately disabled, including direct API requests attempting to enable it. No key read, no provider call, no invented AI success. These are NOT AI-generated RAMS/CPP. Actual provider integration, token/cost budgets and provider failure tests remain outstanding and require a separate credential decision before API-dependent implementation. No paid activation is requested in this change.

Reliability: startup and backup check SQLite health, foreign keys, hash-linked audit history and record-to-audit consistency. Checks detect local corruption/modification, not a privileged attacker able to rewrite the whole database and audit. Backup still uses SQLite VACUUM INTO, verifies the copied file and never overwrites an existing destination. Existing backup restoration/migration tests pass.

Validation: 48 automated tests pass in the combined branch. Typecheck/build pass. Five browser suites pass (V3.6/recovery, surveys/tenders, engineering/construction/QA/handover, attendance and source-linked CPP/PDF/independent review) at desktop/tablet/mobile with no uncaught page errors. Existing PDF layout and development proxy/security tests pass. V3.6 source byte checks remain unchanged.

Remaining scope: live AI integration/cost controls; richer RAMS/CPP structured authoring and review checklists; granular project assignments across all legacy non-workforce staff modules; operational retention and real-person release. Existing staff access outside workforce remains role-based across projects, as on main. This PR does not represent completion of all Issue 4 acceptance criteria.
