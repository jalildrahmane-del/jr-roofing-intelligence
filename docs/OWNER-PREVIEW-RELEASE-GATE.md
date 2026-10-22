# Owner preview release gate — Expansion PR #15

**State: automated integration passed on commit 606672a (GitHub Actions run #22).** Windows owner preview and manual acceptance remain unverified. Do not describe this as released, deployed or merged. New commits require another successful validation.

## Verified by source inspection
- App routes include commercial, construction, quality, handover, documents and workforce.
- New modules have imports and user-facing integrations in main/ApprovalWorkflow/Workforce/Documents.
- Commercial changes are server-side manager-only and stored as auditable project records.
- V3.6 is preserved as a separate legacy workspace; no migration or silent data merge.
- The original drone video and poster returned HTTP 200 and non-empty bodies in automated browser tests; visual playback on the owner's actual devices is not yet verified.
- No paid AI provider, hosting service or deployment was enabled.

## Local Windows owner preview

On a Windows laptop with Node.js 24+, obtain the source of this feature branch and double-click `OWNER-PREVIEW-WINDOWS.cmd` from the extracted project folder. It installs locked dependencies when missing, builds the UI and opens the local browser at `http://127.0.0.1:3000`. It does **not** create accounts, disable authentication, seed production data, reset the database, deploy to the internet or install Node.js. A manager account must first be provisioned privately as documented in README.md. Do not use real project data during the preview.

## Mandatory no-cost local validation
On an already available local development machine (do not provision a paid runner or new hosted environment):

```sh
git switch feature/owner-command-centre-expansion
npm ci
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:dev
npm run test:pdf
```

Record exact failures, stack traces, commands and successful retests before moving the PR out of draft. Never mark tests passed based on merely adding test files.

## Manual acceptance checks
1. Login as manager; create a fictional project; refresh and verify persistence.
2. Visit the dashboard and verify legacy drone poster/video playback and fallback.
3. Create and revise roofs, defects and linked photos; ensure gaps update.
4. Create estimates with stale sources and compare correctly without false pricing confidence.
5. Register source, draft RAMS/CPP with exact excerpt, verify PDF and separate manager review; reject self-approval.
6. Add programme tasks, site diary, hold points and snags; verify latest revision and overdue status.
7. Register commercial budget, costs and variations; reject invalid amounts, stale revisions and non-manager writes.
8. Record synthetic workforce attendance and independently review it; ensure unverified hours are not counted.
9. Review handover gaps, superseded engineering approval, release blockers and client acceptance; no automatic safety certification.
10. Check mobile viewport, keyboard access, authentication, CSRF, project separation and restart/backup recovery.

## Release criteria
- All build, typecheck, unit, browser, PDF and dev checks pass on the actual branch.
- No critical defects; manual owner journey passes.
- Security and safety approval gates remain intact.
- Owner explicitly approves merge and any deployment/cost.
