# Issue 4 development checkpoint — not ready for review

Issue 4 remains isolated on `codex/issue-4-document-security`, starting from merged main `db7c059` (Issues 1–3). It does not include owner-staging changes from PR #9. Work was paused to prioritise the owner's separate secure staging preparation request.

Current unreviewed implementation:

- Migration 3 adds project membership and controlled document file tables. Existing same-company professional visibility is preserved at migration; new projects start private to their creator.
- Store enforces project read/write/admin membership, audited membership changes and last-admin protection.
- API routes enforce document-file/project access and return explicit disabled status for AI generation.
- Controlled manual document revisions, source-linked factual claims, suggestions, limitations, immutable submission/review records, contributor independence and stale-source/reviewer-authority checks are implemented server-side.
- Attachments are held in SQLite, served as authenticated downloads and checked for size/encoding/type and stored hash. PDF original-file handling remains untrusted and requires human review.

Still required before any Issue 4 review PR:

- Finish and inspect the document-control/access-management UI, review PDF output and operator journey.
- Adapt legacy test fixtures to explicit project memberships without weakening negative access tests; fix migration fixtures for schema 3.
- Add full document lifecycle, cross-project isolation, unauthorized file access, approval invalidation, restore/integrity and desktop/mobile/PDF tests.
- Audit attachment validation and all API error handling; do not claim full content/malware scanning.
- Complete recovery tooling/documentation and acceptance report; run complete exact-head CI.
- Reconcile shared server/backup changes with whichever independent PRs are actually merged. Do not pull unmerged staging code into this branch implicitly.

The existing Issue 4 preparation remains at `codex/issue-4-preparation/docs/issue-4/`. Latest user scope explicitly keeps AI generation and paid integrations disabled. No credential provisioning or paid calls are authorised or required. This checkpoint is a durable development record, not a completed feature or release approval.
