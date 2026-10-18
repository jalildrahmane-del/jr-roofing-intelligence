# Issue #1 audit and recovery findings

Scope: GitHub Issue #1 only, 18 October 2026. No deployment, merge, external AI calls, paid services or workflow runs.

## What the resumed run found

- Local branch `codex/issue-1-recover-v36` already held commit `b7580b7`, containing prototype recovery, React/TypeScript shell, Node API, SQLite store and initial tests.
- The GitHub branch still pointed to the initial commit `ba99409`; no pull request existed. The previous run had not finished publishing its recovery work.
- GitHub's initial commit contained only a README, not the application.
- The supplied V3.6 ZIP is a complete self-contained prototype: `index.html`, `roof-drone.mp4`, `roof-poster.jpg`, `README.txt`. It is not an existing React project. All four original files match the ZIP byte for byte.

## Defects fixed

1. **Prototype parser failure.** A closing script tag embedded inside report-generation JavaScript terminated the inline HTML script. The runnable recovery uses `public/legacy/app.js`, preserving report generation and the rest of the original application. The exact original source remains archived.
2. **Malformed imports.** Null project/task records and invalid nested structures could crash rendering. Imports now validate shapes, IDs, photo URLs, unsafe object keys and complexity before replacing saved data.
3. **Silent saved-data fallback.** Unreadable browser data previously fell back to demo data and could later be overwritten. A recovery warning now blocks writes, preserves the original string and offers its export. Reset/import requires an explicit user action. A failed import write restores the previous in-memory dataset.
4. **Hidden backend failures.** Network/server failures could disappear into the login view. They now display a retryable error. Logout failures are displayed instead of becoming unhandled promises. Empty calculation and unknown-route pages have useful navigation.
5. **Numeric coercion.** Boolean/blank inputs and overflowing results could produce misleading or non-finite preliminary arithmetic. They now fail validation. All calculations remain preliminary.
6. **HTTP validation.** The local-host restriction now applies to static assets as well as APIs. URL parsing is inside error handling. JSON must be an object; request bytes are bounded before decoding. The recovered prototype cannot make network API calls under its CSP.
7. **Migration and restore gaps.** Added transactional migration handling, schema compatibility checks, restrictive database file permissions, a consistent SQLite backup command and a tested restore path. Newer unknown schema versions are rejected.
8. **Development startup gap.** `npm run dev` now starts both UI and API with a same-origin proxy, preserving CSRF checks. Playwright is pinned in the lockfile, rather than relying on an unrecorded global package. Worker accounts cannot list unallocated projects.

## Preserved functionality

| Prototype section | Retained behaviour |
| --- | --- |
| Dashboard | Portfolio counts, current project, JSON import/export and explicit reset |
| Projects | Create and select projects |
| Roof Survey | Survey details, photo findings, searchable materials, custom materials, options, report preview |
| Structural Screening | Preliminary load arithmetic and reviewer reference; no certification |
| Design & Specification | Build-up, insulation, covering, drawing reference and notes |
| Construction | Activities, priorities and statuses |
| QA & Inspections | Inspection outcomes and notes |
| Client Handover | Readiness summary and draft text download |

The React shell preserves access to the recovered workspace and adds authenticated project creation and preliminary load records. The other module routes explicitly say their implementation is pending. They are not claimed as finished features.

## Review boundaries

This foundation is for local, trusted-workspace review. Legacy data is browser-local and its page is accessible without login. It retains inline event handlers and a restricted legacy CSP. Server data belongs to one trusted internal workspace; this is not multi-tenant customer isolation. Worker access is restricted, but allocation management belongs to the later workforce issue. HTTP session cookies are HttpOnly and SameSite Strict; TLS and Secure cookies are required for future hosting.

Records are append-only through the API. Hash-linked audit rows are local tamper detection, not independent forensic proof. A database administrator can rewrite them. Password/session hashes, local origin checks and role tests establish a baseline, not a completed production security review. No engineer approval, workforce/GPS system, paid AI integration or later-issue feature has been added. Original engineering and compliance limitations remain visible.
