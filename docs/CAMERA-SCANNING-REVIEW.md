# Attendance camera review — 2 November 2026

Baseline inspected: main d19e0f1; Issues #1–#5; historical closed PRs #12/#13; integration/completion notes. This change is stacked on PR #29 at 91bda1474fa813bdeec5feb55383607d9462ab4a, preserving unmerged #26–29 work. It does not replace the conflicting PR #14 branch.

## Acceptance
- [x] Explicit worker action requests rear-facing video only; no audio or continuous GPS.
- [x] Capture fills the supervisor token; never submits an event or grants approval.
- [x] Existing server signature, expiry, worker/project/event binding and independent review remain authoritative.
- [x] Camera tracks stop after capture, cancel, hidden page or component unmount; cleanup is idempotent.
- [x] Independent 60-second deadline covers pending permission, video startup and detector promises. Late camera permission releases its tracks; late detection cannot fill the token.
- [x] Unsupported/denied camera and detection errors explain image/token alternatives; oversized QR payload rejected.
- [x] Browser tests exercise successful capture, cancellation, denied permission, delayed permission after cancellation and timeout followed by delayed permission. Timeout uses an accelerated test timer; camera/detector use synthetic media.
- [ ] Physical iPhone/Safari camera acceptance. BarcodeDetector availability varies; fallback is required.

## Verification
Local: production TypeScript/build and 123 unit/API/security tests pass. All nine browser suites passed (combined and targeted runs); development proxy/security and PDF checks pass. Original V3.6 routes/archive regression remains covered. Initial camera fixture needed a painted video frame; browser testing caught duplicate stop calls, fixed with idempotent cleanup. CI results are not claimed here.

## Remaining scope
Issue #5 remains open: date summaries/filters, payroll interface acceptance, outside-site exception policy, privacy/retention policy and implementation, physical device verification. Material/delivery photo evidence is included in the combined review below; notifications remain in the completion plan. Issue #4 still requires separately authorised AI provider work; AI stays disabled. No merge, deployment, purchase, payment, real-person release or engineering sign-off occurs here.

## Combined review — 6 November 2026

Recovered material priorities and request/delivery photographs are integrated with this camera branch. Integration review found the server still returned `camera=()`, which would block real camera access despite successful mocked media tests. The policy now permits same-origin camera access (`camera=(self)`) and continues to deny microphones. The workforce browser suite checks both the HTTP header and the actual document feature policy before exercising QR capture/cancellation and material photograph workflows together. Physical iPhone/Safari acceptance remains pending.
