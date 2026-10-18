# Issue 4 independent preparation

Documentation and synthetic acceptance cases only, based on merged main at a4b4f3f. No runtime code, API wiring, credentials, account setup, paid services or deployment. Issue 3 PR #8 remains separately reviewable and unmerged. The evidence below is preparation, not a claim that AI integration is implemented.

## Approved requirement coverage

| Issue 4 requirement | Acceptance evidence required before review |
| --- | --- |
| Server-side AI integration | Browser bundles, network responses, errors and logs contain no credentials. Missing configuration produces an explicit unavailable state. No paid request until separately authorised. |
| Survey narratives, specifications, RAMS and CPP drafts | Document type-specific sections, clear draft label, source-linked observations, limitations, unresolved inputs and named human review. No generic paragraph presented as a completed technical document. |
| Document analysis | Uploaded text treated as untrusted evidence, not instructions; extraction limitations and exact source/page/revision visible. Scans without reliable extraction remain unresolved. |
| Source traceability | Verified statements cite an accessible project source/revision/page or evidence ID. Suggestions remain labelled suggestions. Missing, contradictory and superseded sources are surfaced. |
| Human review | Generation cannot set an approval status, close a safety query, appoint a reviewer, issue a certificate or release work. Human changes/reviews remain auditable. |
| Cost controls | Live generation disabled without explicit spend authorisation; enforce server-side request/output/concurrency limits, bounded retries, cancellation and usage visibility. Avoid secrets and source contents in usage logs. |
| Meaningful errors | Missing credentials, denied access, unavailable models, quota/rate limits, timeout, invalid output and extraction failures have recoverable UI states. Never display fake success or an empty app. |
| Reliability | Existing recovery/tender/PDF tests remain mandatory. Add provider-independent failure fixtures; only separately authorised live smoke checks may spend API credits. |
| Backups and migrations | Existing consistent SQLite backup/restore, future-schema rejection and evidence-blob preservation remain release gates. New data must survive restoration and additive migrations. |
| Accessibility and responsiveness | Keyboard-only generation/review, labelled controls, announced progress/errors, retained drafts on failure, 390/768/1440px flows. Record physical Safari validation separately. |
| Release controls | Changelog, exact-head CI, documented limitations, threat-model review and human security/engineering approvals. No automatic deployment. |

## Existing baseline to retain

Main already contains authenticated server routes, same-origin writes, HTTP-only sessions, local SQLite audit/backup/migration support, controlled survey evidence and independently reviewed tender PDFs. Tests cover 18 unit/API cases, recovery and survey-to-tender browser workflows, actual PDF text/layout/totals and development proxy behavior.

PR #8 adds human engineering/construction/QA/handover gates and increases the suite to 27 tests. That runtime integration must be evaluated after its merge; this preparation does not import or assume unmerged application code. In particular, no generated draft may become an engineer decision or bypass the record-specific reviewer checks.

## Threats and required controls

| Threat | Required outcome |
| --- | --- |
| Prompt injection inside a document | Document cannot grant roles, retrieve secrets, invoke tools, send emails, change project state or override review rules. |
| Fabricated material certification or engineer consent | Output cannot assert compliance, capacity, safe loading or signed consent without source evidence; unresolved questions stay unresolved. |
| Cross-project evidence leakage | Every referenced document/evidence item is authorised for the current authenticated project, on the server. Never accept project/actor identity from generated text. |
| Secret leakage | Do not include credentials in prompts, browser state, PDFs, exports, diagnostics or stored drafts. Credential provisioning requires a separate explicit decision. |
| Citation laundering | References must resolve to actual accessible evidence and the quoted claim. A plausible-looking citation string is insufficient. |
| Paid-call loops | No automatic regeneration on render, navigation, failure, retry loops or background timers. Explicit server permission and bounded budgets required before activation. |
| Stale review | Changed sources or edited drafts reopen the corresponding human review; historical versions remain available. |
| Unsafe export | Draft status, provenance, limitations and human-review state survive PDF/download. A failed provider call cannot create an approved artifact. |

## Synthetic evaluation pack

`acceptance-cases.json` contains expected outcomes for verified facts versus suggestions, hostile source instructions, conflicting revisions, incomplete engineering evidence, missing configuration, provider failures, unauthorised access and backups. It is test input, not an executable service or a mock AI-success implementation. Later automated tests must assert these outcomes against real validation logic and clearly distinguish mocked transport from live provider behavior.

## Decisions deliberately deferred

Model selection, credentials, provider account/project, spend ceiling, retention/data-sharing terms and deployment are not inferred. They are relevant only when actual integration/activation is authorised. No secret inspection, creation or reuse was needed for this documentation-only preparation. Use secure credential handling before any API-backed implementation; never request a key in chat.
