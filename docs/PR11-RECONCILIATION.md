# PR #11 reconciliation against current main (13 November 2026)

PR #11 is based on an October implementation and cannot be merged wholesale into the current application without resolving substantial conflicts.

## Existing on main (verified by source inspection)
- `server/documents.ts`: human-authored RAMS/CPP/survey/specification drafts with exact source excerpts, hashes, immutable revision records, independent manager review and live stale/superseded status.
- `src/document-review.ts`: structured review checklist.
- `server/store.ts`: explicit per-project read/edit grants, revocation, and audit history.
- `server/integrity.ts`: audit and record integrity verification.
- `tests/documents.test.ts`: source provenance, independent review, stale-source invalidation, cross-project isolation, disabled paid AI, PDF output and tamper detection.
- `server/index.ts`: document endpoints. Existing code is authoritative; do not replace it with the older PR #11 server files.

## Additional protection in this integration
- Test immediate revocation of document read, write and PDF access while preserving manager visibility.

## Outstanding PR #11 elements to assess separately
- Restore/backup recovery workflows and full verification of attachment integrity, session revocation and operator procedures.
- User-facing controlled document review screens: compare older `src/DocumentWorkflow.tsx` against current app before porting.
- Browser and PDF end-to-end review checks, with tests adapted to current architecture.

## Merge gate
Run current full validation and document-specific tests. Do not merge PR #11 itself or overwrite current modules. No AI activation, hosting, production deployment, or paid services.
