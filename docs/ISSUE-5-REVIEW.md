# Issue 5 attendance review

This branch implements a local, fictional-data review workflow. It does not authorise real-person tracking or payment.

- Manager configures geofence and named supervisors, allocates registered worker accounts with shift/rate, and can revoke allocations.
- Worker submits own check-in, breaks and check-out. Server receipt time, actor, event sequence and audit hash are server owned.
- Supervisor QR is signed, worker/event/project bound, expires after 60 seconds and redeems atomically once. Restart invalidates outstanding QR challenges. GPS uncertainty is assessed; outside fixes fail, uncertain fixes remain pending.
- All events require independent review. Corrections append new review records and reasons without rewriting events. Offline acceptance requires a supervisor-verified timestamp.
- Worker offline queue is scoped by account/project, retained across reload, and retried using idempotency identifiers. It stores no GPS or QR token. An offline page must already be open; this is not an installable offline PWA.
- Daily progress and weekly quantities explicitly remain reported evidence. Complete independently accepted shifts deduct breaks; missing/rejected/nonchronological events cannot create verified hours. Rates are captured at event receipt. Payment comparisons capture report snapshots and variance, not payment authorisation. Reports use UTC dates; overnight shifts are attributed to their start date.
- Workforce data is excluded from generic snapshots/dossiers. Workers see only their allocated project/own workforce records; supervisors require explicit site assignment.
- QR image import uses BarcodeDetector where supported, with token entry fallback. Live camera scanning is not enabled.

## Privacy release gate
Server configuration only accepts syntheticOnly=true. Before any real-person use, owner must approve controller/processor roles, lawful basis, worker notice and access/correction process, DPIA, retention periods for GPS/attendance/backups and a tested deletion/pseudonymisation process. No live rollout is included. Test accounts are created using the existing create-user script; this module does not open public registration.

## Verification
41 automated tests including lifecycle, QR binding/replay, uncertain/outside GPS, allocation revocation, report breaks and HTTP checks. Existing regression browser suites preserve V3.6, surveys/estimating, engineering/construction/QA/handover. Dedicated browser journey covers QR issuance, GPS submission, offline queue/reload/sync and responsive layout. Original V3.6 byte checks are unchanged.

## Limitations requiring further release work
GPS is client-supplied point-in-time evidence, not proof of physical presence. Audit hashes provide local tamper evidence, not protection against a privileged database administrator. No real-person privacy release, continuous tracking, payroll export integration, payment execution, camera scanner or paid service is enabled. A separately scoped subcontractor-owner role is now implemented in the follow-on review branch: manager-granted project access, company-only records and no access to exact GPS or non-workforce APIs. See DEVELOPMENT-PROGRESS.md for current verification and remaining scope.
