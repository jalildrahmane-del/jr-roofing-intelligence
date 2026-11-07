# JR Roofing Intelligence — prototype acceptance matrix

**Scope:** a no-cost, synthetic-data prototype; not a production, employee-data or paid-AI release.

| Journey | Existing automated browser evidence | Owner acceptance still required |
| --- | --- | --- |
| Legacy workspace, persistence, import/export | `tests/browser.mjs` | Video playback and visual quality on actual iPhone |
| Roof survey, sourced materials, estimates and tender | `tests/tender-browser.mjs` | Review fictional quantities, prices and PDFs |
| Engineering, construction, QA and handover gates | `tests/gates-browser.mjs` | Complete a fictional project from start to handover |
| Source-linked RAMS/CPP and independent review | `tests/documents-browser.mjs`, `tests/safety-authoring-browser.mjs` | Read and assess document PDF and review decisions |
| QR, GPS, offline attendance and daily reports | `tests/workforce-browser.mjs`, `tests/workforce-integration-browser.mjs` | Test actual iPhone camera, location, QR and offline recovery |
| Project access and workforce comparisons | `tests/project-access-browser.mjs`, `tests/workforce-comparison-browser.mjs` | Confirm correct project and role isolation |

## Release gate

- [ ] Final main commit passes `npm run validate` and GitHub Actions full validation.
- [ ] Owner opens private browser preview as documented in `docs/PRIVATE-BROWSER-PREVIEW.md`. Confirm GitHub Codespaces usage limits and private port before starting.
- [ ] Owner signs in on desktop and iPhone, checks all routes for broken UI and horizontal overflow.
- [ ] Owner completes fictional survey → materials → estimate → RAMS/CPP → engineering → construction → QA → handover.
- [ ] Owner checks revisions, rejections, PDF evidence and persistence after restart.
- [ ] Owner checks iPhone GPS permissions, QR, camera, offline queue and resync with fictional workers.
- [ ] Any defects are recorded, fixed and retested; owner signs off the prototype.

**Do not infer 100% completion from green CI alone.** A private preview is not yet a deployed service. No paid AI, live staff tracking or production certification is implied.
