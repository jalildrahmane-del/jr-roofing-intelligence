# Step 7 — project access and document revisions

31 October 2026. Review branch: `feature/project-access-document-revisions-step7`. Stacked on Step 6 / PR #20 (`9df2b2d5e3c3cb978e549d952834316735bfa392`). Neither review step is merged by this change.

## Result and upgrade behaviour

Engineers, supervisors and viewers previously inherited every project's general records. They now require a manager's explicit project assignment. Managers retain access to all projects and manage assignments from **Project Register → Project team access**. Choose a registered staff member, read-only/edit/revoke, and a reason. Viewers can only receive read-only access. Each update appends a revision and reason to the audited history; stale updates are rejected rather than overwriting a newer decision.

**Existing staff must be assigned after this change is accepted.** There is no automatic grant to every existing project. A manager remains able to administer the existing data. No projects, documents, evidence or decisions are deleted. The existing schema and backup mechanism are retained; assignments are immutable project records. Permission metadata is separate from saved project data, so adding an assignment does not silently alter old tender snapshots or fingerprints.

Checks run on the server for snapshots, record commands, document reads/writes/PDFs, reports, dossiers and evidence. Read-only UI hides authoring actions, and direct requests cannot bypass the checks. Revocation applies to subsequent requests using the existing session; it cannot erase files or content already downloaded. Signing out also clears the account's cached project state.

Workforce allocations remain separate: a workforce-only supervisor can see the assigned site in Workforce, without receiving its general documents. Staff document access grants no workforce authority. Workforce photographs still require workforce authorisation even when the caller has general project access. Standalone QR redemption now checks the workforce allocation. Staff dossier exports omit manager-only commercial audit detail as well as commercial records and private assignment history.

Historical professional decisions are retained. Revoking software access is distinct from withdrawing an engineer's appointment or signed technical decision; the existing mandate/review revocation gates continue to govern that process.

## Document revision workflow

Open a current document's **Revise document** action. The editor carries forward its title, complete proposed content, limitations and every source reference/excerpt. The author can update these and select current evidence revisions. A stale source must be replaced before saving. Older revisions remain readable, the old review remains historical, and the new revision needs a new independent review. Concurrent attempts to replace the same old revision fail safely. The current source chooser in the RAMS/CPP composer excludes superseded source revisions.

The revision editor preserves the formatted risk text; it does not reconstruct that text into individual risk-entry fields. It retains existing references rather than adding a new source-management system. AI remains disabled, and document review does not certify engineering or authorise work.

## Validation

Full local validation passed: `JR_CHROMIUM_PATH="$PWD/.data/browser/chromium" npm run validate`.

- 102 unit/API/security tests; TypeScript and production build.
- All eight browser suites, preserving V3.6, survey/tender, engineering/construction/QA/handover, attendance, integrated workforce/weather, source-linked documents and Step 6 risk authoring.
- New manager read/edit/revoke journey and multi-source revision workflow at 390/768/1440px, with fresh independent review, persisted history and revocation checks.
- Development proxy/session/origin tests and A4 PDF content/totals/printable-bound checks.

Final focused checks passed after small UI/permission-cache adjustments: TypeScript, six project-access tests, production build and the new browser suite. These tests include backup/restore of revoked grants, stale update rejection, protection against read-only evidence writes, private-project PDFs/evidence, workforce-photo isolation and commercial-audit confidentiality. The 390px revision-editor screenshot was inspected. No uncaught page errors were observed in the browser journey.

Existing fixtures now explicitly assign synthetic engineers/supervisors instead of depending on inherited project-wide access. An initial QR regression exposed the older generic project check; it now requires a workforce assignment, and its fixture configures one. An intermediate test assertion was corrected after permission metadata was moved out of project snapshots. No GitHub CI success, physical iPhone validation or native Windows acceptance is claimed.

## Remaining sequence

Next: richer structured document review checklists and evidence/revision usability, then outstanding workforce matching/reporting and release hardening. Actual AI provider integration, real-person privacy release, physical-device acceptance and production deployment remain separate. Issues #4/#5 remain open. This PR does not merge changes, deploy or activate paid services.
