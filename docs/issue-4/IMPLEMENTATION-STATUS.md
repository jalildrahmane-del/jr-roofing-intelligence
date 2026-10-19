# Issue 4 — Document review, security and reliability

Implemented on `codex/issue-4-document-security` from main `db7c059`. Owner-requested scope takes precedence over the original issue's AI wording: all generation and paid integrations remain disabled.

## Architecture and security

Migration 3 adds project membership and document attachment tables. Existing professional same-company visibility is migrated; new projects are private to their creator. A project administrator explicitly grants read/write/admin access. Global professional roles still constrain actions. Last-administrator removal is rejected. Server routes enforce membership for state, evidence, document downloads, exports and writes. Workers cannot download controlled documents. Membership changes are audited.

Document records are append-only revisions. Stable document number, unique revision label, previous record ID and server-owned author/time preserve lineage. Submission and independent manager review refer to the exact record ID and revision. All contributors in the document lineage and its submitter are barred from independent approval. Source revision changes, dependent document approval changes and reviewer access changes invalidate current approval. Regranting permissions does not revive an old approval. Document approval never substitutes for engineering or construction release.

Optional PDF/text files are limited to 4 MiB, validated for filename, canonical encoding and basic content signatures, stored in SQLite with SHA-256, and downloaded through authenticated project checks with attachment disposition and sandbox policy. These checks are **not malware scanning** or a guarantee against malicious PDFs, including compressed/obfuscated active content. Keep the system local and use trusted synthetic files for owner review. Full malware scanning and independent security review are prerequisites for broader operation.

The document UI separates manual content, source-linked factual claims, limitations and suggestions. It exposes revision history, submission/review findings, project access management, original downloads and a generated review PDF reflecting live approval status. Original V3.6, survey/estimating, engineering, construction, QA and handover remain available. The main dashboard includes the preserved drone footage and the Windows static-path correction from the separately requested preview work.

## Recovery

Stop the application before switching databases. Run `node scripts/verify-database.ts PATH` to verify SQLite integrity, foreign keys, schema, audit chain and attachment hashes. `npm run backup -- NEW-BACKUP.sqlite` makes a consistent WAL-aware snapshot and verifies it. Keep a separate copy on an owner-controlled offline drive; no cloud service is activated.

Restore using `node scripts/restore.ts BACKUP.sqlite NEW-RESTORED.sqlite`. Existing destinations are refused. Verification happens before and after restore; restored sessions are revoked and a restore audit event is recorded. Keep the previous database and WAL/SHM files together. Point `JR_DB` to the restored file, sign in again and inspect project counts, documents, attachments and approval history before resuming work. Revert to the untouched original if validation fails. Browser-local V3.6 JSON needs its separate export/import procedure.

Local audit hashes provide tamper evidence, not protection against a privileged operator rewriting the entire database and hash chain. There is no hosted service, public registration, AI provider configuration or automatic deployment.

## Operator workflow

1. Open Documents for the selected project. An administrator can expand Project access to assign an independent reviewer.
2. Create a manual draft with a unique document number/revision, content and limitations. Select evidence records for factual claims and provide a page/location reference.
3. Submit the exact revision with an explicit human attestation.
4. A different authorised manager signs in, records findings and a reference, then approves for document use or requests changes.
5. Use Create next revision for edits; old content remains in history. Withdraw approval when needed. Review live status before relying on a downloaded PDF.

## Validation

32 unit/API/security/regression tests cover the original workflows and document lifecycle, contributor independence, stale approvals, cross-project access, file validation/rollback, authenticated PDFs, disabled AI and verified backup/restore. Browser workflows exercise the original application plus desktop/mobile manual document creation, submission, independent review and PDF download. TypeScript/build, development smoke checks and Poppler PDF validation form the CI gate. Refer to the PR's exact-head CI for final validation status; no deployment or merge is authorised by these tests.
