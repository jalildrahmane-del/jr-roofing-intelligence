# Architecture, migration and recovery

## Source layout

- `docs/original-v36/`: exact original four supplied files, never edited; hashes in `docs/v36-sha256.txt` and checked by tests.
- `public/legacy/`: runnable recovery of all eight prototype sections. Inline JavaScript was extracted to fix an embedded closing-script HTML parser defect. Uses existing `roofai_v1` browser storage, with safe import/recovery checks.
- `src/`: React/TypeScript workspace, API client and shared validation. Unimplemented later-issue modules are explicitly labelled.
- `server/`: loopback Node HTTP API, SQLite persistence, roles, server timestamps and hash-linked audit records.
- `scripts/`: account creation, development runner, browser preparation and consistent SQLite backup.
- `tests/`: unit/API/recovery/backup tests and Chromium desktop/mobile smoke tests.

SQLite stores users, hashed sessions, projects, immutable-through-API records and audit entries. Passwords use salted scrypt; only session-token hashes are stored. Server validation owns IDs, timestamps, statuses and role decisions. The server has no AI/network provider integration. The UI does not receive any API secrets.

Authentication controls server data; the preserved original workspace is separate and browser-local. No automatic conversion or deletion of legacy records occurs. To move between origins, export/import the original JSON explicitly. Keep an export before changing browser, origin or version.

## Schema and migrations

`server/migrations.ts` defines versions 1 and 2. Version 2 adds project-linked immutable image evidence; original tables and records are retained. Creation and the version marker commit in one transaction. Existing version-1 data is preserved during the additive version-2 migration. Required schema columns are checked on startup; unknown schema versions fail closed. Future changes must add a new numbered migration, update the supported-version logic and include migration/restore tests; never change an applied migration silently. There is no automatic destructive down migration.

Take a snapshot before each schema upgrade. `npm run backup -- /private/new-backup.sqlite` uses SQLite `VACUUM INTO`, which captures a consistent committed database including WAL data. It does not overwrite backups and verifies integrity. Protect backups as sensitive files; they contain project data and credential hashes. Export browser-local legacy data separately, as it is not in SQLite.

## Restore/rollback procedure

1. Stop the API and development runner. Keep the current database and any `-wal`/`-shm` files together as a quarantined recovery set. Do not copy an open WAL database with ordinary file-copy tools.
2. Restore the selected snapshot to a **new** private path. Do not overwrite the current live database or attach an old WAL to a restored snapshot.
3. Check out the application commit matching the snapshot schema. Set `JR_DB` to the restored file.
4. Start locally; verify login, project/record counts and sample data before further writes. The automated restore test checks migration preservation and restored records. Use SQLite `PRAGMA integrity_check` for an additional operator check.
5. Restore/import the browser JSON separately if needed. Import replaces the local prototype dataset after explicit confirmation.

The automated test takes a snapshot while a WAL database is open, restores to a separate file, verifies projects and records, reruns the migration and rejects a future version. Live data is never involved in this test.

## Security and operating limits

Only loopback hosts are allowed, including static assets. Writes require same-origin JSON requests. Development proxy origin rewriting only applies to matching incoming browser origins. Login attempts are throttled; sessions expire after eight hours and logout revokes them. Managers create projects; manager/engineer/supervisor accounts may save preliminary calculations; viewer/worker accounts cannot write. Workers see only allocated/own project records, with allocation functionality deferred to its issue. Issue #2 also allows author roles to save surveys, defects, photo metadata, material sources, tender options and PDF snapshots; only an independent manager may approve document snapshots. See `ISSUE-2-DESIGN.md`. Internal professional roles share the trusted local workspace.

The original prototype keeps its inline UI event handlers under a legacy-only CSP and cannot fetch the API (`connect-src 'none'`). Input values are escaped and imported photo URLs constrained. Local HTTP cookies are not marked Secure because this is not hosted. TLS, external identity, multi-tenant/project authorization, retention, monitoring and independent security/engineering review remain prerequisites for hosting. No deployment configuration is included.

The current workflow runs checks on the authorised Issue #2 branch and permits manual dispatch. Execution is guarded to a public repository using the free standard hosted runner, with no cache saves, artifact uploads, deployments or paid API calls. It validates the existing foundation and the full survey-to-tender journey, including Poppler PDF content/bounds checks. See the PR Actions run for the current result.

## Issue 4 update

The former shared professional visibility is now replaced by explicit project membership, with existing access migrated as described in [Issue 4 architecture and operator guide](issue-4/IMPLEMENTATION-STATUS.md). New projects are private. Controlled document revisions, independently recorded reviews, authenticated attachments and live-status PDFs are integrated into the actual application. Schema version is 3. Recovery now verifies audit and attachment hashes and revokes restored sessions. Public hosting still requires independent security approval; AI and paid integrations remain disabled. CI now targets the authorised Issue #4 branch and includes document desktop/mobile workflows.
