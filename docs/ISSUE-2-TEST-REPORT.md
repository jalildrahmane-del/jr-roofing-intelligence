# Issue #2 validation

## Automated coverage

- Eighteen unit/integration tests cover the existing foundation plus multi-roof records, typed validation, exact cost reconciliation, unpriced/zero rates, stale revisions, category/unit/source rules, bounded photo/GPS/annotation input, immutable blobs, independent document approval, expired/unpriced quotes, overdue manufacturer source reviews, v1-to-v2 migration, WAL backup/restore including evidence and approvals, PDF bytes and authenticated access to images/PDFs.
- The existing browser regression still covers all eight legacy sections, all thirteen shell routes, saved-data recovery, persistence, import/export, report preview, retry and logout.
- The new end-to-end browser test creates a project, two roof surveys, a defect, GPS photo and annotation revision, a sourced synthetic material, five cost categories and two alternatives. It reconciles £5,775.00 and £1,200.00 synthetic option totals, reloads the project, downloads a draft and approves/downloads the immutable quotation using a separate manager account.
- Desktop/tablet/mobile checks run at 1440, 768 and 390 pixels. There is no root horizontal overflow; comparison tables and navigation deliberately scroll within their containers. Zero uncaught page errors are required.
- PDF checks use real downloaded/generated PDFs, Poppler text extraction, page metadata and word bounding boxes. They verify A4 output, no PDF JavaScript, multiple roofs, GPS/provenance, image SHA, annotation references, source limitations, Unicode specification symbols, exact monetary totals, reviewer/approval status and printable text bounds.
- TypeScript, build, development proxy smoke and original archive hash checks remain part of validation.

## Visual inspection

Synthetic report pages and desktop/mobile screenshots were rendered and inspected. Corrected an orphaned pricing heading, text-position drift after image annotation numbering, and a split totals block. Reports now retain the totals block together and keep all extracted text within printable bounds.

Local validation uses the pinned Playwright package and local bundled Chromium fallback. Run `npm ci`, install Chromium with `npx playwright install chromium`, install Poppler (`poppler-utils` on Ubuntu), then `npm run validate`. The optional `JR_CHROMIUM_PATH` fallback remains available as documented in README.

CI uses the standard hosted Ubuntu runner, guarded to this public repository and the authorised Issue #2 branch. No cache saves, artifact uploads, paid APIs, deployments or merges are configured. GitHub's latest run on the PR head is the authoritative CI result; a run on an older commit is not final acceptance.

## Review evidence

Synthetic screenshots under `docs/evidence/issue-2/` show the survey workflow, option comparison and responsive screens. Two clearly synthetic sample PDFs are included alongside the screenshots for review. Test PDFs and page renders are also generated under ignored `artifacts/` and can be reproduced locally or in CI. They are test fixtures, not real inspections or commercial quotations.
