# Step 6 — RAMS / CPP risk review

31 October 2026. Based on merged main `e6d5801a5773f444d383b2a27c5b2f3c94fb2050` (Step 5 / PR #19). Review branch: `feature/document-risk-review-step6`.

## Result

The structured RAMS/CPP composer now displays a coloured, text-labelled 5 × 5 risk matrix and live initial/residual risk bands. A formatted preview lets authors read the exact proposed content before saving. Source evidence and limitations remain separate in the saved revision and review PDF.

Previously the form allowed up to 25 activities and individually valid field lengths whose combined formatted text could exceed the server's 30,000-character limit. The composer now shares that limit with the server, identifies oversized complete drafts before submission and preserves every entered field so the author can edit it. It never truncates controls. Textarea and rating controls have stable accessible names after editing.

Risk thresholds are the existing application bands (Low 1–4, Medium 5–12, High 13–25); this change does not introduce a safety standard. The matrix is a browser authoring aid. The PDF preserves textual ratings and controls; it does not yet render the coloured grid. AI generation remains disabled. Drafts require independent review and cannot grant engineering approval or permission to work.

## Validation performed

`JR_CHROMIUM_PATH="$PWD/.data/browser/chromium" npm run validate` passed:

- TypeScript and production build.
- 96 unit/API/security tests, including exact 30,000-character acceptance and rejection one character above the limit.
- All seven browser suites: original V3.6 recovery, survey/tender, engineering/construction/QA/handover, attendance, integrated workforce/weather/company access, document revisions, and the new structured risk authoring journey.
- Development proxy, session and cross-origin checks.
- Existing A4 PDF content, monetary totals and printable-bound checks.

The new browser journey checks all 25 matrix cells, live initial/residual ratings, exact draft preview, oversized-content preservation, successful correction and save, PDF risk/control/source text, self-review rejection, separate-manager acceptance and reload persistence. It checks 390/768/1440px layouts and captures synthetic screenshots. No uncaught page errors occurred.

After shortening the matrix labels for narrow screens, the production build and the new browser journey were rerun successfully. The 390px screenshot was visually inspected; labels, fields and buttons remain readable without horizontal scrolling.

Early test attempts exposed unstable implicit textarea/select accessible names; explicit labels fixed them. The self-review test was corrected to match the existing server denial message. The first unconfigured browser invocation had no installed Playwright browser; the repository's bundled Chromium preparation script supplied the local executable for subsequent successful checks. These were local checks; no GitHub CI result is claimed.

## Remaining sequence

Next document/security work: granular project permissions across the non-workforce staff modules, richer structured review/revision tools, then remaining controlled AI integration criteria if separately authorised. Workforce still needs the outstanding schedule matching/reporting, camera and operational privacy acceptance described in the integration checklist. Physical Windows/iPhone owner acceptance remains outstanding. Issues #4/#5 remain open. This branch does not merge, deploy, activate a paid service or release real-person use.
