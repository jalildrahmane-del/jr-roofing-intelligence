# Workforce integration acceptance — 31 October 2026

Baseline: Step 5 merged PR #19 into main at `e6d5801a5773f444d383b2a27c5b2f3c94fb2050`. PR #16 is closed and PR #14 remains a separate conflicting branch. The list below describes the integrated main branch, rather than the earlier partial staging snapshot. No production deployment is authorised.

## Integrated
- [x] Existing schedule comparison, CSV and offline queue utilities from PR #19 baseline.
- [x] Offline queue validation connected to the newer workforce UI. Corrupt data remains stored, is not synced, and cannot be overwritten by a new offline submission.
- [x] Project/user-keyed session isolates token, confirmation, queue, loaded report, photos and generated QR state.
- [x] Preserve newer site-navigation QR, worker project confirmation, daily photos, director dashboard and existing server approvals.
- [x] Company-scoped owner access, manager grants and workforce report isolation reconciled on main.
- [x] Structured shift persistence, revisions, cancellation, overlap checks and workforce UI reconciled on main.
- [x] Project-postcode weather, hourly rain/wind/gust forecasts, refresh and planning advisories in Workforce. External feeds require network access; automated browser tests use synthetic forecasts.

## Step 6 — document risk review (review branch)
- Coloured, labelled 5 × 5 RAMS/CPP risk matrix and live initial/residual score badges.
- Formatted draft preview with a shared 30,000-character server limit. Over-limit drafts stay editable and are never silently truncated.
- Browser acceptance covers structured RAMS entry, PDF content, rejection of self-review and separate-manager review at mobile/tablet/desktop widths.
- This is human-authored document tooling. Live AI/provider integration remains outstanding.
- Validation and review details: [Step 6 report](STEP-6-DOCUMENT-REVIEW.md).

## Still required
Step 7 is prepared on a separate branch stacked on Step 6 / PR #20. See [project permissions and document revisions](STEP-7-PROJECT-ACCESS-REVISIONS.md) for implementation, upgrade behaviour and validation. These review-branch changes are not yet on main.

- [x] Step 7 review branch: manager-controlled staff project read/edit/revoke permissions, request-time enforcement, audit and backup persistence.
- [x] Step 7 review branch: multi-source document revision editor, current-source selection and fresh independent review.
- [x] Step 8 review branch, stacked on PR #21: type-specific independent review checklists, server acceptance checks, conflict protection and PDF review evidence. [Scope, upgrade behaviour and tests](STEP-8-DOCUMENT-CHECKLISTS.md).
- [x] Step 9 review branch, stacked on PR #22: planned/verified comparison, supervisor-confirmed unique matching, evidence invalidation, history and scoped CSV. [Scope and tests](STEP-9-WORKFORCE-COMPARISON.md).
- [ ] Date filters and daily/weekly comparison summaries; remaining attendance-only/payroll export acceptance.
- [ ] Camera lifecycle integration and payroll interface acceptance; ambiguous split allocations remain outside Step 9.
- [ ] Acceptance of the Step 7/8 permission and checklist stack; remaining document/AI intelligence criteria.
- [ ] Owner privacy/retention policy and corresponding implementation before real-person use.
- [ ] Physical iPhone/camera verification.

Step 5 baseline validation: 95 local automated tests and production build passed; all six existing browser suites passed again in the Step 6 workspace. Current branch validation is recorded in the Step 6 report. AI remains disabled. Issues #4/#5 are not complete.
