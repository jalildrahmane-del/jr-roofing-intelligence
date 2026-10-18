# Issue #1 validation report

Validated 18 October 2026. Node 24.19.0; TypeScript 6.0.3; Playwright 1.62.1; local bundled Chromium. Fresh `npm ci --ignore-scripts --no-audit --no-fund` succeeded. Synthetic data only.

## Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed; includes shared model, server, migration/backup scripts and Vite configuration |
| `npm test` | 8 tests passed, 0 failed |
| `npm run build` | Passed |
| `npm run test:browser` | Passed |
| `npm run test:dev` | Passed |
| `git diff --check` | Passed |
| Original archive integrity | All four files match uploaded ZIP; hash preservation also tested automatically |
| Secret-pattern scan | No OpenAI project/service keys or private-key headers in tracked/new text files; not a full security audit |

Unit/integration coverage includes durable persistence and rollback, authentication and role enforcement, 18mm OSB arithmetic without certification, input coercion/overflow, invalid legacy import shapes/identifiers/photo URLs, prototype archive hashes, consistent WAL backup and restore, migration idempotency and future-schema rejection, session revocation, login throttling, JSON/origin/host validation and worker access restrictions.

Browser coverage:

- All eight original prototype sections open at desktop width 1440 and mobile/tablet widths 390 and 768.
- All thirteen React workspace routes open at 1440, 768 and 390; no root-document horizontal overflow at those widths. Mobile navigation intentionally scrolls within its navigation bar.
- Legacy survey, specification, activity and QA data survive reload.
- JSON export/import round-trip works; invalid import leaves saved data untouched.
- Corrupt browser-local data is preserved, visibly flagged and downloadable for recovery.
- Survey report preview opens and contains the saved surveyor.
- Authenticated project creation and preliminary-load save survive reload; no client-supplied approval or timestamp is trusted.
- Backend failures display a retry action; retry, unknown-route recovery and logout work.
- Zero uncaught page errors.

The development smoke test starts the actual UI/API runner, signs in through the proxy and verifies authenticated reads and cross-origin write rejection. Snapshot restore was tested on temporary databases, never user data.

## Screenshots

Committed under `docs/evidence/issue-1/`:

- `dashboard-desktop.png`
- `dashboard-mobile.png`
- `legacy-survey.png`
- `legacy-mobile.png`
- `legacy-recovery.png`

## Reproduction and limits

Run `npm ci`, `npx playwright install chromium`, then `npm run validate`. If the default Chromium download is unavailable, run `node scripts/prepare-browser.mjs`, then `JR_CHROMIUM_PATH="$PWD/.data/browser/chromium" npm run validate`. This run used the already-extracted same bundled Chromium from the prior recovery workspace. Playwright was installed locally from the pinned lockfile.

These are headless Chromium desktop/mobile viewport checks, not physical iPhone/Safari/Android device testing. They are smoke/regression checks, not an exhaustive certification of every prototype operation. No deployment, paid API calls, cloud service activation, GitHub Actions run or merge occurred. At the initial PR creation, CI had not been executed on GitHub. A subsequent owner-authorised follow-up enables free public-repository validation for PR #6; GitHub Actions logs and PR checks are the authoritative record of that run. Cache saves and artifact uploads are disabled.

Later-issue route placeholders do not count as implemented modules. Issues #2–#5 were not started. This Issue #1 change is a local review foundation, subject to the security/engineering boundaries in the audit and architecture documents.
