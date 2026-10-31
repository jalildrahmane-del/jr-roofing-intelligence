# Step 9 — planned versus actual workforce reporting

31 October 2026. Branch: `feature/workforce-planned-actual-step9`, stacked on Step 8 / PR #22 (`9c963eaf7200aa3ecd913cf8cdb08d75aed80b1b`). No review branch is merged by this change.

## Result

Workforce now shows active planned shifts beside independently verified completed attendance. Completed attendance exposes its UTC start/finish, recorded break minutes and exact event/review references; previously the overlap helper had no timestamps from the real attendance report. Planned hours and missing matches never generate attendance or establish an absence.

A unique overlap is a suggestion until an assigned supervisor or manager explicitly confirms or rejects it, records evidence/reasons and attests to checking the plan against verified attendance and breaks. Matching never changes verified hours, recorded rates or payment authority. Worker/owner accounts have read-only comparison access within their existing allocation/company scope.

Decisions are immutable workforce records with the actor, timestamp, preceding decision, plan revision, attendance identity and evidence fingerprint. A changed plan or attendance review invalidates the current confirmation. Stale browser submissions and conflicting decisions fail inside the existing transaction. Revising a plan preserves its prior match history; cancelling it removes it from active comparisons without removing the actual attendance.

The summary separates all active planned hours, all verified hours, confirmed matches, the planned/verified hours within those confirmed matches and their variance. Attendance without a current confirmed match is listed separately with an explicit notice that it is already included in the verified total. Match history shows the reviewer account and reasons.

## Export and boundaries

The scoped CSV includes plan revisions, UTC windows, breaks, net hours, candidate variance, current match status and reviewer account/time. Verified attendance appears once: a unique candidate is shown on its plan row; other verified shifts appear on their own row. Ambiguous plan rows have blank actual/variance fields. Spreadsheet formula-like text is escaped, while negative numeric variances remain numeric. The export is a comparison report, not a payroll interface or payment approval.

The report currently covers all saved active plans and verified attendance for the selected project. Date-range filters and daily/weekly summaries are the next reporting step. Overlapping/split-plan ambiguity must be resolved by correcting plans or attendance; manual allocation of one actual shift across several plans is not included. Cross-project payroll duplication checks are not claimed. UTC interval matching supports overnight and offset timestamps; zero-duration attendance is not an overlap candidate.

Existing company-owner and worker filters run before comparison and export generation. Comparison data contains no raw GPS coordinates. Real-person use remains blocked by the existing synthetic-only configuration. AI and paid services remain disabled. No schema migration is needed; the existing audited record/backup mechanism stores match decisions.

## Validation

Full local validation passed: `JR_CHROMIUM_PATH="$PWD/.data/browser/chromium" npm run validate`:

- 117 unit/API/security tests, TypeScript and production build.
- All nine browser suites, preserving V3.6, surveys/tenders, technical gates, attendance, weather/company access, document controls/checklists and project permissions.
- Development session/origin/proxy checks and existing PDF content/totals/printable-bound tests.

New checks cover unreviewed attendance, recorded breaks/event references, explicit supervisor decisions, corrections, plan revisions/cancellation, stale inputs/competing decisions, ambiguity without double counting, company isolation, CSV numeric/formula handling, overnight UTC intervals and verified backup restoration of confirmations. The browser workflow confirms a match, invalidates it with corrected attendance, records a new decision, verifies worker/owner read-only scope and downloads the company-scoped CSV at 390/768/1440px.

After adding reviewer attribution and the confirmed-plan-hour subtotal, the production build, 12 focused unit/API/export tests and new browser suite passed again. The mobile comparison screenshot was visually inspected. No uncaught page errors occurred. No GitHub CI result or physical-device acceptance is claimed.

## Remaining sequence

Next: date filters and daily/weekly workforce comparison summaries. Remaining release work includes wider reporting/export acceptance, camera/device verification, the owner privacy/retention release and approval of the stacked PRs. Issues #4/#5 remain open. No deployment, merge, paid activation or payroll execution is included.
