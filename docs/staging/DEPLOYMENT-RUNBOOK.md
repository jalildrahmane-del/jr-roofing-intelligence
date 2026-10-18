# Private owner staging runbook

**Do not execute provisioning/deployment steps until the owner explicitly approves costs and deployment.** All placeholders are intentionally inactive. Latest merged main is the source baseline; apply this reviewed staging PR before release. Keep Issue 4's independent branch separate.

## Proposed service and URL

Railway Hobby, one Node 24 service, one replica in a Europe region, an outbound cloudflared connector in the same container, one 5 GB volume mounted at `/data`; initial resource ceiling 0.5 GB memory / 0.5 vCPU, no autoscaling, no sleep. Store SQLite at `/data/jr-staging.sqlite` including WAL/SHM and photo blobs. Real measurements must confirm PDF memory peaks fit; raise limits only with cost approval.

Owner URL: `https://jr-roofing-staging.<existing-domain-in-your-Cloudflare-account>`. This is a format, not a registered or live address. Cloudflare Access's normal browser protection needs a domain in an active zone; a generated Railway hostname alone is not a substitute. Do not buy or repurpose a domain without approval. Railway public networking remains disabled; no Railway-generated/custom public domain or TCP proxy is needed.

Create a Cloudflare Access self-hosted application covering the complete hostname and every path. Named approved email allowlist only; use an existing identity provider with MFA where available, or email one-time codes plus the application's separate password. Set Access application session duration to one hour or less. Configure no bypass policies. Copy its audience/team settings into server configuration; never accept identity based solely on an email header.

## Manual release sequence — after approval

1. Record approved code SHA, successful CI run and resolved container base-image digest. Use a dedicated empty Railway staging project. Set Hobby compute email alert at US$7.50 and hard threshold at US$10, subject to approval. Keep Railway Agent, external services and integrations unused; no credentials for them.
2. Create one empty service with public networking disabled and attach one volume at `/data`. Select config path `deploy/staging/railway.json`. Do not connect a GitHub autodeploy source. Disable automatic image updates, automatic deployment triggers and preview environments. Document these dashboard settings: they are not encoded by the JSON file.
3. Enter the approved non-secret settings from `deploy/staging/variables.example`. `JR_ACCESS_ACCOUNTS` maps each approved lowercase email to a distinct locally provisioned username. Set no AI/email/deployment keys. Set `PORT=8080` to match the named tunnel route; Railway supplies `RAILWAY_VOLUME_MOUNT_PATH`. Create a named Cloudflare Tunnel only after approval and store its token as `JR_TUNNEL_TOKEN` in Railway secret settings, never in chat, git or process arguments. Leave Railway public networking disabled permanently.
4. Build the real app with `deploy/staging/Dockerfile` from the reviewed commit. Provision the volume with `node scripts/seed-staging.ts owner-review`, reading a newly generated unique password from private stdin. Do not put passwords in arguments, logs, git, chat or environment examples. The seed refuses an existing DB. Provision additional individual reviewer accounts only if their email/username mapping is approved; no default test passwords are ever used live.
5. Confirm all projects/users are synthetic/mapped, then start the guarded entry point. It drops to UID/GID 1000 (and clears supplementary groups) after assigning the volume, validates the marker, binds the internal port and supervises cloudflared. A connector failure stops the application. Never set Railway's runtime UID to an unprivileged user before this mount handoff. No data migration is run in a predeploy command, where the volume is unavailable.
6. In the remotely managed named Cloudflare Tunnel, publish only the approved hostname to `http://127.0.0.1:8080`, set the HTTP Host Header to that exact approved hostname, and retain a catch-all 404 route. Create the hostname DNS through the tunnel configuration in the existing Cloudflare zone. Enable the exact Access application/policy **before** publishing this route. Use cache bypass for the entire host. Browser HTTPS ends at Cloudflare; the authenticated tunnel encrypts transport to cloudflared, with HTTP only on loopback inside the container. Do not create a Railway public domain/TCP proxy, toggle DNS-only, use quick tunnels, or relax certificate validation to work around Railway proxied-domain TLS limitations.
7. Verify Railway public networking is disabled, the named tunnel is connected, and unauthenticated/direct-origin rejection, named-email authentication, local password layer, HTTPS cookie and CSRF behavior. The health endpoint is the sole non-sensitive liveness exception. Remove unexpected hostnames/routes and service tokens. No alternate generated-domain login links. After tunnel-token rotation, update the Railway secret and manually restart through the approved release process.
8. Take an encrypted off-volume backup and restore it into a new offline DB. Verify owner login, photo evidence and a real generated PDF from the restored copy. Test a service restart and confirm the original volume data survives.
9. Owner acceptance: open the URL on laptop and iPhone Safari, pass Access email/identity authentication, then the separate local app login. Review the genuine survey, estimating, engineering and handover pages. Verify portrait/landscape layout, PDF download, signed-out access and a fresh private Safari session. No development tools are needed on either device.

## Backups, recovery and rollback

Use `node scripts/staging-backup.ts backup /data/jr-staging.sqlite /private/new-backup.jrb < /private/passphrase-file` in the runtime/admin environment. This takes a consistent WAL-aware snapshot, removes sessions, verifies integrity/audit/evidence and encrypts with a separate passphrase (minimum 16 characters). The plaintext temporary directory is removed. Exports are limited to 256 MiB; review storage growth before reaching that limit. Copy the encrypted export to owner-controlled storage **outside the Railway volume and account**, with the passphrase in a separate password manager. No new cloud backup service is needed for this small staging workspace. Never expose a backup download URL or commit a database/export.

Retention proposal: 7 daily and 4 weekly off-volume copies, plus one before/after each review/release. Railway daily snapshots can provide convenience recovery, but are billed and volume deletion also removes those snapshots. Enable them only within the approved budget. Confirm a fresh restore at least weekly during staging; proposed RPO 24 hours and manual RTO 4 hours are operational targets, not measured guarantees.

To recover, stop the service and writes; preserve a forensic copy of the failed volume. Run `node scripts/staging-backup.ts restore ENCRYPTED_BACKUP NEW_OFFLINE_DB < PRIVATE_PASSPHRASE_FILE`. Wrong passphrases, tampering, unsupported schemas, non-synthetic data and existing targets fail closed. Check the restored copy against this release, then replace the live database only during maintenance after preserving the previous DB/WAL/SHM. Never copy only a live `.sqlite` file without a consistent snapshot. Restart and repeat both authentication and PDF checks. Restored sessions are invalidated.

For code rollback, first capture a verified backup and select the last approved code/image SHA. Do not roll back code across a schema change without its matching database backup. This PR changes no schema. Runtime guards reject unknown backup schema versions. Railway restore actions are deployments and require the same approval as a release.

Revocation: remove the email from Access policy and revoke active Access sessions; remove its runtime email mapping and revoke local sessions for that account in a controlled maintenance action. Short Access lifetime bounds old tokens, but do not rely on expiry alone. Sign out of both the app and Access when finished. The banner offers an Access logout link; app Sign out revokes the local session.

## Approval inputs still required

- Explicit permission to provision/deploy this staging-only proposal and the approved monthly spending threshold.
- Existing domain/hostname available in the owner's Cloudflare account (or a separate domain decision).
- Exact authorised email addresses and individual local account names.
- Owner-controlled destination for encrypted backups and the responsible operator.

These inputs are intentionally not guessed. No payment details, password or API key should be sent in chat.
