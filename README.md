# JR Roofing Intelligence — survey-to-tender review build

Recovered V3.6 prototype plus a React/TypeScript, Node 24 and SQLite foundation. Local development only. No deployment, paid integrations, telemetry or default accounts. Issues #2/#3 supply the survey-to-tender and approval-gate journeys. The document-control foundation, owner command centre and workforce integration are merged into main through PR #19 (`e6d5801`). Issues #4/#5 still have outstanding acceptance criteria; merge does not authorise production or real-person use. See [current sequence and remaining work](docs/INTEGRATION-PROGRESS.md).

## Start locally

Use Node **24 or newer** and npm:

```sh
npm ci
```

Provision an account. Read the password from a private file (12 characters minimum); never put a real password in source code, command arguments or Git:

```sh
node scripts/create-user.ts USERNAME manager < /private/password-file
```

Remove the private password file when provisioning is complete. Valid roles are `manager`, `engineer`, `supervisor`, `worker`, and `viewer`. Use synthetic data for this review build.

Development with UI hot reload and the authenticated API:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies same-origin API requests to port 3001. `JR_WEB_PORT` and `JR_API_PORT` override these ports. Both processes stop together.

Alternatively, test the built application:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3000. The server binds only to loopback. Set `PORT` to override the built server's port. `JR_DB` overrides the default SQLite location `.data/jr.sqlite`.

## Existing prototype and saved data

Open `/legacy/`, or select **V3.6 Original Workspace** after signing in. All eight prototype sections remain accessible. Its data remains in browser local storage under `roofai_v1`, separate from the authenticated database. Existing saved data on another URL/browser must be exported there and imported here; browser origins do not share storage. Import/export remains available; data does not silently become approved server evidence.

The exact supplied HTML, video, poster and README are preserved in `docs/original-v36/`, with SHA-256 hashes. The runnable recovery extracts the original inline script to fix an HTML parser defect. Invalid saved data is protected from overwrite, with an original-data export and explicit reset/import recovery path.

## Validate

```sh
npx playwright install chromium
npm run validate
```

This runs TypeScript checks, unit/integration tests, production build, desktop/mobile Chromium tests, a development proxy smoke test and PDF content/layout checks. Install Poppler (`poppler-utils` on Ubuntu) for PDF checks. Browser tests require the build and write synthetic-data screenshots to `artifacts/`. GitHub Actions integration validation runs for the owner expansion branch and its pull request. The workflow installs Chromium and Poppler on a standard GitHub-hosted runner, then runs the full validation command. No deployment or paid APIs are configured. Confirm current GitHub Actions billing settings before increasing runner usage.

If standard Chromium download is unavailable, the installed bundled Chromium dependency can be extracted locally:

```sh
node scripts/prepare-browser.mjs
JR_CHROMIUM_PATH="$PWD/.data/browser/chromium" npm run validate
```

`JR_PLAYWRIGHT_MODULE` optionally selects an externally installed Playwright module; normal `npm ci` installs the pinned version locally.

## Survey to tender

See [the complete Issue #2 journey and calculation policy](docs/ISSUE-2-DESIGN.md) and [validation coverage](docs/ISSUE-2-TEST-REPORT.md). Create roof surveys, defects and annotated photo evidence; record manufacturer/source data; price and compare options; then generate PDF snapshots. A different manager must explicitly review and approve a document for issue. Document review never grants engineering certification.

Migration 2 automatically adds image evidence storage while preserving version-1 records. Take a backup before upgrading. Images and snapshots are included in SQLite backups; legacy browser JSON remains separate.

## Backup and rollback

```sh
npm run backup -- /private/new-backup.sqlite
```

This makes a consistent snapshot including committed WAL data, checks integrity, restricts file permissions and refuses to overwrite an existing destination. See [architecture and restore procedure](docs/ARCHITECTURE.md), [audit findings](docs/ISSUE-1-AUDIT.md), and [validation report](docs/TEST-REPORT.md).

### Engineering, construction and handover — Issue 3

The existing Design, Construction, Quality and Handover routes now contain revision-controlled registers and server-enforced human approval gates. Engineering acceptance requires a separately appointed engineer and exact current evidence; preliminary OSB arithmetic never certifies safety. Reviewed controls, stage inspections, snags and O&M/client evidence gate release and closeout.

See [Issue 3 architecture and operator journey](docs/ISSUE-3-DESIGN.md) and [validation report](docs/ISSUE-3-TEST-REPORT.md). The authenticated handover dossier export includes immutable record history and audit hashes. No deployment or paid integration is enabled.
