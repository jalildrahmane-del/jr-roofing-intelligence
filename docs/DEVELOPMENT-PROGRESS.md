# Approved scope progress — 23 October 2026

This checklist distinguishes implemented review-build behaviour from outstanding release criteria. No merge, deployment or paid activation has occurred.

## Source baseline
- Main: db7c059 (Issues 1–3 merged).
- Attendance PR #12: d583c081.
- Document PR #13: 4d972513, stacked on #12.
- This change is a separate draft on top of PR #14 (9568622), incorporating the newer PR #13 origin fix. PR #15 (309cfea) is concurrent expansion work and has not been modified or integrated. Do not independently merge stacked branches without reviewing the dependency order.

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
- [x] Dated shifts with explicit timezone, planned breaks/hours, cross-project worker overlap rejection, immutable revisions/cancellation reasons and stale-write protection. Manager/assigned supervisor writes; workers/company owners see scoped schedules. Planned hours never become verified attendance or payment.
- [ ] Automatic planned-versus-actual shift matching and payroll-system integration. Scheduling currently displays plans alongside the independent attendance report; matching and payroll remain unimplemented.

## Issue 4 acceptance
- [x] Human-authored source-linked RAMS/CPP/survey/specification drafts, immutable revisions and exact source excerpts.
- [x] Independent manager review, source-change invalidation and PDF review export.
- [x] SQLite/foreign-key, audit-chain and record-audit integrity checks on startup and backup.
- [x] Worker/viewer/owner restrictions on document intelligence; workforce owner cannot access dossiers, photos or general project records through authenticated APIs.
- [ ] Granular project grants for existing non-workforce staff roles.
- [ ] Rich structured RAMS/CPP authoring and review checklists.
- [ ] Actual AI provider integration, budgets and provider-error tests; no paid API activation is authorised. Existing drafts are expressly not AI output.

## Validation for this change — 23 October 2026
54 local automated tests passed. TypeScript/build passed. All six browser suites passed; the owner journey also creates a shift through the manager UI and checks scoped export of planned hours with zero verified hours. Coverage includes desktop/tablet/mobile, company-only downloaded JSON, grant revocation, V3.6 recovery, surveys/tenders, engineering/construction/handover, workforce and documents. PDF output and development proxy/security checks passed. V3.6 byte preservation checks passed. No GitHub CI success is claimed: the existing workflow only automatically validates the historical Issue 3 branch targeting main; other branches do not run its validation job.

## Next implementation work
Continue granular non-workforce project permissions, attendance plan matching and richer RAMS/CPP structure without enabling AI. Coordinate with PR #15 before changing its new authoring/dashboard modules. Company scope currently uses exact registered company strings; account company changes require controlled administration (there is no self-service company editor). No live-person use is authorised. Retention policy choices must not be invented or implemented by deleting audit records silently.

## Shift verification detail
- Cross-project overlap is checked inside the same SQLite write transaction as the append. Adjacent shifts are allowed; timezone-equivalent overlaps fail.
- Invalid calendar dates, missing timezone, reversed or over-24-hour windows and invalid breaks fail before any append.
- Revisions must reference the latest uncancelled revision and cannot change worker identity. Cancellation preserves history and frees the interval.
- API/unit tests cover worker/owner write rejection, owner company filtering, stale cancellation, revision history and zero verified attendance from plans. Browser tests cover manager creation and owner export at 390/768/1440px.
- Synthetic-only restriction remains. This does not complete Issue #5 or authorise real-person use.

## 25 October report detail update
Verified completed shifts now export and display their reviewed UTC start/end and actual verified break minutes alongside net hours and rounded amount. Planned breaks are never substituted. Existing reconciliation hashes may become stale because the report now includes these additional evidence fields; compare again rather than treating old comparisons as current. Automatic schedule matching remains outstanding.
Validation: 54 local unit/API tests and production build passed. Browser regression outcome is recorded in the run report; no CI success is claimed.

## 26 October schedule comparison
- [x] Scoped planned-versus-verified overlap diagnostics in UI and JSON export. A variance appears only for a unique one-to-one overlap; multiple attendance spans or a span crossing multiple plans requires review. Cancelled/superseded plans are excluded. No overlap is labelled as no verified completed overlap, never as proven absence.
- [x] Actual reviewed net hours are compared with planned net hours; planned breaks never change verified attendance or payment totals.
- [ ] Explicit supervisor-confirmed assignment of attendance to scheduled work, payroll integration and remaining release criteria above are still outstanding. Time overlap is only a diagnostic.
Validation: 56 local unit/API tests and build passed. New tests cover absent evidence, worker isolation, actual break differences, cancellation and ambiguous overlaps. Browser outcome is reported separately. PR #15 remains untouched at d77644d; this change extends PR #16 only. No AI activation, merge or deployment.

## 27 October verified timesheet export
- [x] Spreadsheet-ready CSV of completed verified shifts, with UTC dates/times, actual breaks, net hours, recorded rates and rounded shift amounts. Uses the already-authorised workforce report, preserving company/worker scope.
- [x] Spreadsheet formula-leading text is neutralised and quoted; pending events and schedule plans never become payable rows. Export explicitly states that calculations are not payment authorisation.
- [ ] Payroll-provider integration and independent payment approval remain outside this export. All earlier privacy, project-permission and document acceptance gaps remain open.
Validation: 57 local unit/API tests and build passed. Added CSV formula/quoting and pending-only exclusion tests plus owner browser download assertions. Full browser outcomes are recorded in the run report. AI remains disabled; no deployment or merge.

## 28 October offline reliability repair
- [x] Workforce session state remounts on project or user change, isolating queued events, tokens, challenge images and loaded reports. This prevents a previous project's in-memory queue being submitted under a newly selected project.
- [x] Offline storage is shape-validated. Corrupt JSON/non-array/invalid events fail closed with an explicit recovery message; original storage is preserved, sync is disabled and new offline writes cannot overwrite it.
Validation: 58 local automated tests and build passed; browser regression includes malformed storage preservation and disabled sync. No real-person data used. Remaining acceptance criteria above stay open.
