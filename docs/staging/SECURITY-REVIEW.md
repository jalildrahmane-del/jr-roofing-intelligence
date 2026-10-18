# Owner staging security review — preparation only

Baseline: merged main `db7c05981853fcf8237ef5e714d8e72311499029` (Issues 1–3). Issue 4's unmerged document/permission work is not included. This is the genuine existing application with deployment guards, not a separate prototype. No infrastructure has been created, accounts provisioned, domain purchased, service activated or deployment performed.

## Disposition

**Prepared for code/security review, not approved for exposure.** The local-only application must not be deployed unchanged. Runtime changes and verification below are proposed in this PR. Final hosting approval, hostname/email inputs, real provider configuration and live device smoke tests remain required before owner access. This is not a professional penetration-test certificate or engineering approval.

## Findings and controls

| Baseline finding | Proposed staging change / acceptance evidence |
| --- | --- |
| Loopback listener and localhost-only HTTP assumptions | Explicit separate staging entry point binds Railway PORT on 0.0.0.0 only with validated HTTPS origin, Access configuration, mounted volume and synthetic marker. Default local start remains loopback. |
| HTTP-only development cookie lacks Secure flag | Staging uses Secure, HttpOnly, SameSite=Strict, host-only `__Host-jr_session`; no Domain attribute. Exact HTTPS-origin checks protect writes. App sessions remain eight hours; Access application tokens are capped at one hour. |
| Proxy header spoofing / direct Railway hostname | Never trust an email header or forwarded host. Verify RS256 signature against fixed account JWKS, issuer, app audience/type, time claims and exact email map. Railway public networking stays disabled: a named outbound Cloudflare Tunnel connects to the container. Literal Host must match the approved hostname; forwarded protocol must be HTTPS. No token URL or key is taken from request claims. |
| Public static/V3.6 paths in local app | Every staging path except minimal health requires signed Access identity. V3.6 additionally requires the mapped application's authenticated session. Bundles/login page require Access; database/evidence/PDF/dossier routes require both layers. |
| Existing workspace shares professional-role project visibility | Owner staging is one synthetic review workspace with only individually mapped approved reviewers. This is not safe for real multi-client tenancy; Issue 4 permissions remain a separate change. No broad staff rollout. |
| Generic local account may be reused across visitors | Email-to-local-username mapping checked at login and each authenticated request. Another allowed email cannot reuse the owner's app session. No default accounts, shared preset password or public registration. |
| In-memory login throttle would group proxy users | Key staging throttle by cryptographically verified Access email. Untrusted forwarded IP headers cannot rotate it. Limit resets on process restart; Access is the external first layer. |
| Container disk is ephemeral | Dedicated `/data` SQLite/WAL volume, one process/replica and one region. No build/predeploy writes to the volume. Node runs unprivileged after root hands off the root-owned volume. |
| Same-volume snapshots do not cover account/volume loss | Separate AES-256-GCM encrypted, verified SQLite exports retained on owner-controlled storage; passphrase kept separately. Native Railway snapshots are an additional recovery aid only. |
| Incomplete backup verification | Validate SQLite integrity, foreign keys, exact migration version, audit hash chain, record-to-audit match and photo hashes; restore to a new offline file, revoke sessions and refuse overwrite/tampering. |
| Arbitrary pre-existing data could reach staging | Explicit synthetic-only configuration and seed marker; startup rejects unmarked/non-synthetic project names or unmapped accounts. Persistent UI banner and project-name rule. Human operators must still keep all entered content synthetic; a label cannot classify private data automatically. |
| Outbound integrations and secret leakage | No AI/email/deployment credentials accepted in staging environment. No SDK/provider calls wired. AI endpoint explicitly disabled. Only fixed Cloudflare JWKS retrieval and the named outbound tunnel are needed; TLS verified, timeout, bounded response, cache and refresh limits, fail closed on unavailable keys. |
| Deployment on GitHub push would bypass approval | No deploy workflow or provider credentials in CI. Railway service must use manual upload of a reviewed commit, with GitHub autodeploy/image updates/PR environments disabled. The config file does not itself disable dashboard source automation; operator verification is a release gate. |
| Malformed PNG could throw inside PDFKit’s asynchronous decoder | Validate bounded PNG compressed scanlines before upload/storage and before rendering old evidence. Reject invalid data through normal error handling rather than crashing the process. |
| Unsafe or unexpected runtime behavior | Request/header timeouts, bounded restart retries, graceful SQLite shutdown. Health endpoint returns only `{ok:true}`/`{ok:false}` and no customer/version/config information. |

## Residual boundaries

Cloudflare protects access, not structural safety. All existing engineer appointments, independent inspection and handover gates remain unchanged. Synthetic load calculations and approvals are never real site permission. The seed leaves engineering pending and produces a draft survey PDF only.

The V3.6 browser-local workspace is preserved and remains separate from server records; data persists only on that browser. It uses its existing limited legacy CSP exceptions. Stage users must not import real files into legacy storage. Use a dedicated staging hostname so cookies/storage are isolated from any production application.

JWT validation is implemented with Node's built-in crypto and tested with synthetic signatures. A live Cloudflare token/certificate rotation check, Railway TLS/origin behavior, volume restart and restore exercise are mandatory after deployment approval. No forged fixture key is shipped in runtime configuration. The cloudflared 2026.10.1 binary is pinned to official SHA256 checksums. Its tunnel token is a Railway runtime secret passed via child environment only, never command arguments or logs. Automatic client updates are disabled; tunnel process failure stops the app and bounded restarts apply. Docker base tag must be resolved/recorded to an image digest during the approved release; CI builds but does not publish an image.

No public Railway application route is configured. The internal `/healthz` exception reveals only liveness and is reserved for platform health checks. Browser TLS terminates at Cloudflare; the authenticated outbound tunnel carries traffic to cloudflared, then to HTTP loopback inside the same container. No Railway custom domain or Full/Flexible TLS workaround is used. Railway documents certificate mismatches with its proxied-domain setup, which is why the proposal uses a tunnel instead. Cache bypass applies to the complete hostname. Cloudflare's email policy is deny-by-default with named addresses, no wildcard domain, bypass, Everyone or service-token policies.

## Stop conditions

Stop and keep routing disabled if an unauthorized address gets past Access, direct origin serves application content without a valid token, a Secure cookie is absent, hostname/audience drift appears, original/private data is present, backup verification fails, volume persistence fails or any CI/security check is failing. No approval exception may be inferred from a successful build.
