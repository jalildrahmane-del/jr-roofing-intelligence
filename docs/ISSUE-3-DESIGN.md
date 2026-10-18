# Issue 3 — Engineering, construction and handover gates

Built on main at a4b4f3f, preserving the recovered V3.6 workspace, Issue 2 surveys, material provenance, estimating, photo evidence and PDFs. No external services or new dependencies. No schema changes: additive immutable record kinds use existing SQLite transactions, audit hashes, migrations and backups.

## Review authority

| Action | Server-enforced authority |
| --- | --- |
| Drawing, load case, structural query, RFI | Manager or engineer |
| Project engineering appointment/revocation | Manager; existing engineer account, externally verified qualification/appointment reference, scope, expiry and explicit attestation |
| Engineering decision | Engineer with current project appointment; independent of all submitted package records; exact current package key; signed engineering reference and rationale |
| Construction plans, programme, diary, ITP, snags, O&M register | Manager, engineer or supervisor |
| Controls, ITP results and snag reinspection | Independent manager or supervisor, evidence, competence reference and attestation |
| O&M acceptance / final handover | Independent manager; final acceptance also requires externally signed client acceptance reference, representative and date |
| Work releases / fire-watch closeout | Manager or supervisor with explicit attestation; fire-watch reviewer independent of permit author |
| Worker / viewer | No write access to these records; worker cannot export full dossiers |

An engineer role alone never authorises structural acceptance. Account provisioning remains the existing local administrative CLI; managers cannot create engineer accounts through the app. Qualification and appointment documents must be checked outside the software. Manager appointment is an auditable human assertion, not software verification of professional registration. Authorisation must accurately describe the entire submitted package scope. Software cannot assess structural adequacy, competence, authenticity of references or professional judgement.

## Engineering lifecycle

1. Record drawing number, revision, controlled source and purpose. Revise an existing drawing to supersede it; duplicate number/revision and stale edits are rejected. Every old revision remains.
2. Save preliminary dead-load arithmetic using the existing structural screen. Record load cases referencing immutable calculations, current drawing revisions, assumptions, loading sources and the engineer's calculation document. This is traceability, not a structural calculation engine.
3. Record structural queries and RFIs with current references. Every saved preliminary load must have a load case. At least one drawing, load case and structural query is mandatory.
4. A separately appointed engineer explicitly accepts, rejects or requests information. Acceptance requires a substantive recorded response to every current query and RFI, signed evidence reference and attestation. References to superseded drawings or cases block acceptance.
5. The server binds review to exact drawing, load, case, query and RFI IDs. New inputs/revisions invalidate acceptance. Appointment revocation, replacement or expiry invalidates that engineer's acceptance. Rejection/information-required decisions override earlier acceptance of the same package.

**18 mm OSB acceptance case:** the existing calculator always returns `Preliminary / Not approved`. Recording OSB inputs cannot approve work. A current traceable package, manager-recorded qualified appointment and independent human engineer decision are required. The original preliminary record never changes into a safety certificate.

## Construction lifecycle

- Work scope records explicitly select scaffold and hot-work applicability with rationale. RAMS, CPP and working-at-height controls are always mandatory. No exemptions are inferred from missing data.
- Controls include controlled document reference, hazards/method, rescue arrangements, competence evidence, UTC start and expiry. Scaffold expiry represents the next required inspection/review selected by a competent person; no statutory inspection interval is guessed. RAMS/CPP content is recorded manually; AI generation is Issue 4.
- One current scope and one control per category prevent an older approval being used while a replacement awaits review. New revisions preserve originals and require independent review.
- Mandatory ITP hold points exist at prestart, installation and final stages. Each records criteria, method and source. Independent inspection records include accepted/failed/information-required results, evidence and competence.
- Explicit stage releases run in order. The server rechecks engineer authority, dependencies, current controls, permit dates, QA and preceding releases inside the write transaction. Stale page keys cannot override changes made by another reviewer.
- Changes to design, work scope, relevant controls or stage hold points require fresh releases for affected current evidence. Failed reinspection immediately blocks further work at that hold point. UI displays current blockers; refresh before starting or resuming site work. Browser status never overrides the POST-time checks.
- Programme captures baseline/current dates, immutable predecessor revisions, progress and actual dates. Date sequence, future actuals, incomplete predecessors, cycles and stale predecessor references at handover are rejected. This is a programme register, not a critical path scheduling engine.
- Site diary captures observed weather, labour/plant, activities, delays/safety events and evidence references. No live weather service or attendance/productivity system is enabled.
- Used hot-work permits require an independent, retrospectively evidenced fire-watch closeout before handover. Closed permits cannot authorise further work. The qualified permit issuer determines the required fire-watch duration and scope in controlled source documents; the software does not invent legal durations.

## QA and handover

Snags remain pending until remedy and evidence are recorded and independently reinspected. Revisions and later failed inspections reopen acceptance. Mandatory handover categories: O&M, as-built, warranty, test certificate and maintenance. Each document has a revision, source, scope and independent manager review. The register records externally controlled documents, not fabricated certificates or inferred warranties.

Closeout requires current engineering acceptance; all three recorded releases for the current design, scope, controls and stage hold points; accepted current controls and all QA/snags/documents; an as-built drawing; completed programme; site diary; and fire-watch closeout for used hot-work permits. Historical releases retain their original evidence and expiry context: expired temporary permits do not erase permissions recorded while valid, but they cannot authorise new work.

Final manager acceptance requires externally evidenced client acceptance and is bound to the exact dossier. Any subsequent relevant record changes the dossier key and displays final acceptance as pending; old acceptance remains in history. No client identity or electronic client signature is impersonated: the manager records the external signed source explicitly.

## Records, export and security

`src/gates.ts` shares read-only readiness logic with React. `server/gates.ts` exclusively validates and writes human decisions through the existing authenticated same-origin API. Author ID, name, role, timestamp, revision linkage and dependencies are server-owned; client-supplied approval status/identity is discarded. Transactions prevent partial writes.

`GET /api/dossiers/:projectId` exports the project, immutable record history and project-filtered audit entries with hash/previous hash. It requires authentication and denies workers. Session tokens, password hashes and credentials are never included. Project-filtered hash chains can contain gaps where other projects generated events. Local hashes provide tamper evidence, not independently signed or forensic nonrepudiation. The export references original evidence; retain controlled source documents and original photo backups separately.

The existing trusted internal single-workspace permission boundary remains. No new public hosting, external network integrations, paid services or production tenancy claims. Production security and qualified professional reviews remain required before deployment.

## Operator journey

Project Register → Structural Screening (save preliminary inputs) → Design & Engineering (drawings, cases, queries, appointment and qualified review) → Construction Management (scope, reviewed controls and programme) → Quality & Inspections (three stages of ITP, results and snags) → Construction Management (explicit stage releases and diary) → Client Handover (register, independent document review, signed external client evidence, final acceptance and JSON dossier export).

Use a separate engineer and reviewer account. Never use synthetic test evidence or sample account assertions as real site authorisation. V3.6 legacy records remain accessible and are not silently treated as approved evidence in the new gates.
