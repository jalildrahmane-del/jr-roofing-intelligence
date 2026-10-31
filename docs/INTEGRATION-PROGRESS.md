# Workforce integration acceptance — 31 October 2026

Baseline: PR #19 f0911cb on main; earlier PR #16 is closed and PR #14 remains a separate conflicting branch. This update does not merge either branch or deploy anything.

## Integrated
- [x] Existing schedule comparison, CSV and offline queue utilities from PR #19 baseline.
- [x] Offline queue validation connected to the newer workforce UI. Corrupt data remains stored, is not synced, and cannot be overwritten by a new offline submission.
- [x] Project/user-keyed session isolates token, confirmation, queue, loaded report, photos and generated QR state.
- [x] Preserve newer site-navigation QR, worker project confirmation, daily photos, director dashboard and existing server approvals.

## Still required
- [ ] Company-owner role/API/report access reconciliation from PR #14.
- [ ] Structured shift persistence/commands/UI and matching integration.
- [ ] CSV UI integration and camera lifecycle integration with the newer UI.
- [ ] Supervisor-confirmed schedule matching and payroll interface acceptance.
- [ ] Granular staff project permissions and remaining document intelligence criteria.
- [ ] Owner privacy/retention policy and corresponding implementation before real-person use.
- [ ] Physical iPhone/camera verification.

Validation: 95 local automated tests and production build passed. Browser suite results are reported separately. Added corrupt queue preservation/disabled-sync browser assertions to the existing workforce/director-dashboard journey. No CI pass is claimed for this change. AI remains disabled. Issues #4/#5 are not complete.
