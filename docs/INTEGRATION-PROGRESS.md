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
- [ ] CSV UI integration and camera lifecycle integration with the newer UI.
- [ ] Supervisor-confirmed schedule matching and payroll interface acceptance.
- [ ] Granular staff project permissions and remaining document intelligence criteria.
- [ ] Owner privacy/retention policy and corresponding implementation before real-person use.
- [ ] Physical iPhone/camera verification.

Step 5 baseline validation: 95 local automated tests and production build passed; all six existing browser suites passed again in the Step 6 workspace. Current branch validation is recorded in the Step 6 report. AI remains disabled. Issues #4/#5 are not complete.
