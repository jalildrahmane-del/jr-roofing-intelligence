# Issue 3 validation

All fixtures are synthetic. No real engineering approval, qualification or site certification is asserted by these tests.

## Automated checks

`npm run validate` runs TypeScript, all unit/API suites, production build, recovery/tender/gates browser suites, real development proxy smoke and PDF validation.

- 26 unit/integration tests: all original 18 retained plus 8 new gate/security tests.
- Engineering: pending 18 mm OSB; role and project appointment; explicit attestation; every query/RFI response; independent author; revocation; duplicate/superseded drawings; stale keys and dependencies.
- Construction: required controls, independent reviews, expiry/invalid dates, stage sequence, mandatory ITP, failure/reinspection, revised controls, closed hot-work permits and independent fire-watch closeout.
- Handover: mandatory O&M categories, programme and diaries, snag remedies, failed/revised acceptance, independent manager, external client evidence, exact dossier key.
- Durability: restart preserves decisions and audit entries. Existing WAL backup, schema migration and evidence-blob restore tests retained; no migration required.
- HTTP: direct forged structural approval denied, worker/viewer writes denied, unauthenticated/worker dossier access denied, exported audit/history excludes credentials.
- Browser: real signed-in author → appointment → qualified engineer responses → independent QA reinspection → three releases → diary → client-evidenced handover → downloaded audit dossier; refreshed changed control reopens work and handover gates.
- Responsive browser checks at 1440, 768 and 390 px for all four new screens; existing 13 shell routes and 8 legacy routes retained. Zero uncaught browser errors.
- Regression: survey/GPS/annotation revisions, materials, sourced five-category takeoff, comparison, independent tender review and downloaded PDFs retained. Poppler checks actual PDF text, reconciled money, Unicode and printable bounds.

Commands:

```sh
npm ci
npx playwright install --with-deps chromium
npm run validate
```

Install `poppler-utils` for PDF validation. For an existing local Chromium, set `JR_CHROMIUM_PATH` to its executable. Local run used the bundled Chromium binary; GitHub CI uses Playwright Chromium on `ubuntu-latest`.

Screenshots and dossier JSON are generated under ignored `artifacts/` using synthetic data. Reviewed screenshots are included in `docs/evidence/issue-3/`. No credentials, private customer data, caches or CI artifacts are uploaded. GitHub CI results for the exact PR head are linked in the PR description; a local pass does not substitute for CI.

Limitations: browser automation covers Chromium desktop/tablet/mobile viewports, not physical iOS Safari. Recorded competence, external evidence authenticity, structural calculations and site inspection quality require qualified human review. No paid APIs, production deployment or automatic safety certification were exercised.
