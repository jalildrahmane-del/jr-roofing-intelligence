# Competitive benchmark and accelerated delivery plan
Date: 2026-10-21
Status: research and implementation priorities, not a claim of feature completion.

## Public product references
- AccuLynx: https://acculynx.com/features/ — pipeline, roof measurement report integrations, estimating, supplier orders, job costing, production calendar, client portal.
- Roofr: https://roofr.com/proposals — digital aerial measurements, waste factors, measurement-to-proposal workflow.
- CompanyCam: https://companycam.com/photo-documentation — timestamped/location-associated project photos, annotations, client progress galleries.
- JobNimbus: https://www.jobnimbus.com/product — production boards, custom workflows, subcontractor work orders, job budgets, communication.
- Raken: https://help.rakenapp.com/en/articles/14492603-getting-started-with-production-tracking-in-raken — cost codes, labour, equipment and production quantities.

Research is about capabilities and workflow patterns; do not reproduce proprietary source code, visual design or licensed assets.

## Product direction
One project record and five owner-facing stages: Survey → Estimate → Engineering → Construction → Handover. Keep modules accessible to the relevant roles and make evidence, changes and blockers discoverable.

## Delivery packages in dependency order
1. Owner UX and recovery: drone hero, stage navigation, project-level activity, next-action cues, accessible mobile navigation, sign-in/proxy reliability. No invented completion or approval percentages.
2. Survey and evidence: multi-roof, defect/photo capture, GPS metadata with permission and accuracy, revision history, offline upload retry and structured photo reports.
3. Tender and commercial: roof takeoff, configurable waste, labour/plant/prelims, rate provenance, margin and VAT controls, option comparisons, branded client PDF, variation and cost-to-complete tracking. Never present stale supplier prices as live.
4. Engineering: controlled drawing register, RFI and load-case references, independent appointment/approval, stale invalidation, temporary works register. No automated structural certification.
5. Construction: project programme, weather observations/alerts with explicit sources, scaffold/WAH/hot work, RAMS/CPP and lift plans, QA hold points, daily diary, subcontractor workforce, quantity-vs-hours productivity.
6. Document intelligence: source-backed drafts, editable structured risk matrix, human approval, provenance, versioning, export. Paid AI provider integration only with explicit owner approval and server-held keys.
7. Handover and reporting: snag closeout, as-built/O&M/warranties, client acceptance, photo evidence pack, project KPIs, cost and progress dashboards.
8. Hardening: per-project permissions, tested backups/restores, security regression, UK GDPR worker data handling, iOS and Windows preview acceptance.

## Acceptance criteria
- A genuine, signed-in owner can follow a complete synthetic project from survey to approved tender, externally evidenced engineering review, construction hold points, QA and handover.
- Every displayed status distinguishes record presence from human approval; revision changes invalidate dependent decisions.
- No live GPS tracking of workers, no structural safety auto-certification, no secret exposure, no unapproved paid service.
- Each package ships with automated tests, mobile/browser evidence, migration and backup tests where applicable.
- Do not merge, deploy or spend without the owner's approval.
