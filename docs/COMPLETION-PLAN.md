# Release completion plan — 1 November 2026

This is the agreed finish sequence. A passing test suite validates implemented behaviour; it does not imply all requirements are complete. Keep additional cosmetic changes outside this sequence unless they block a workflow.

## Current baseline

- Main includes the GPS site-location and app-usability updates (#24–25).
- #26 adds scoped worker names; #27 improves independent review eligibility and save feedback. Both await merge.
- The materials fulfilment branch builds on #27. It adds recording of placed orders, partial/damaged delivery receipts, replacement balances, completion status and director counts. It does not send purchase orders or execute payments.
- The private Codespaces preview must be updated separately. No live deployment or real-person release is implied.

## 1. Complete site operations

- Implemented for review: manager-only placed-order records after independent approval; manager/supervisor delivery receipts; partial deliveries; damaged quantities remaining outstanding; reference-based order/receipt evidence; server timestamps, immutable history and stale/duplicate guards.
- Remaining: daily-report drafts and the outstanding structured site fields (operatives, work areas and conditions); material priority and photo evidence; delivery photos; notification workflow and explicit offline draft/sync behaviour.
- Acceptance: worker submission through independent review, recorded order and checked receipt works on one authorised project, persists through restart and cannot be altered by unauthorised roles. Do not call this entire milestone complete until the remaining fields/evidence/draft requirements pass.

## 2. Complete workforce reporting and mobile operation

- Remaining: date filters and daily/weekly attendance summaries/exports; live camera QR scanning with lifecycle/error handling; real iPhone/Safari GPS, photos and QR checks; resolve Issue #18's reviewable exception requirement for outside-site/denied GPS against the current outside-site rejection behaviour.
- Preserve explicit project confirmation, point-in-time GPS, independent verification and missing-sign-out/sequence checks. No continuous tracking.

## 3. Complete AI document generation

- Manual source-linked RAMS/CPP authoring, review and PDFs exist. Actual AI generation remains disabled.
- Remaining: separately authorised server-side provider setup, controlled draft generation, source traceability, uncertainty handling, cost limits, meaningful errors and independent human review.
- Do not expose keys or activate a paid provider without the owner's required approval.

## 4. Complete staff access and operational reliability

- Remaining: straightforward staff account provisioning/recovery; workforce privacy notice, retention and tested deletion/pseudonymisation controls; operational automatic backups and restore verification.
- Existing roles, project grants, company isolation and backup utilities are foundations, not a completed real-person release.

## 5. Release acceptance and dependable browser access

- Reconcile and merge approved release changes, update the preview, and run a complete owner-reviewed survey → estimate → documents → workforce/site operations → QA → handover journey on laptop and iPhone.
- Resolve remaining defects; validate restart/recovery; agree hosting, access and any costs before provisioning.
- Only then enable authorised staff/real project use. Codespaces remains a temporary private preview.

The wider Issue #18 recommendations (hazard escalation, competency reminders and other extensions) remain tracked separately. They must not silently expand the baseline finish sequence.
