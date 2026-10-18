# Owner staging validation

Tests operate locally or on free public-repository CI using synthetic data and ephemeral cryptographic keys. They create no Railway/Cloudflare resource and make no paid API calls.

- Existing 27 unit/API tests retained; 5 staging tests added (32 total).
- Fail-closed configuration: HTTPS hostname, explicit named email mapping, exact Access audience/team, named tunnel token/fixed internal port, synthetic-only policy and `/data` mount. Connector launch configuration keeps its secret out of argv and disables auto-update. Reject unnecessary integration credentials.
- Real RSA signature verification: wrong key, issuer, audience, expiry, future claims, token type, unknown email, malformed token/algorithm and unavailable JWKS rejected.
- Origin/API behavior: no token or spoofed email header cannot access app, legacy, assets, API or PDFs; assigned local account is required in addition to signed Access identity. Direct Railway hostname and cross-origin writes rejected. Secure host-only cookie, account binding, disabled generation and absent registration checked.
- Encrypted backup/restore: consistent live WAL snapshot; authentication/tamper failure; no overwrite; schema/integrity/foreign-key/audit/record checks; data and document history preserved; sessions revoked; file mode 0600. Modified record data fails audit verification.
- Local HTTPS browser harness: actual production application behind a simulated Access edge injecting a synthetic signed JWT; real TLS with a temporary test certificate. The browser-only harness ignores that self-signed certificate; runtime TLS verification is never disabled.
- Browser widths 1440/768/390: genuine dashboard, survey, materials, estimating, structural, design, construction, QA, handover and documents routes. Secure cookie, real draft PDF download, legacy iframe and both logout/access-denial paths. Zero uncaught page errors.
- Discovered PNG/PDF crash regression: validate bounded PNG compressed scanlines before storage and PDF rendering; corrupt compressed data is rejected without process termination. Backup includes a valid synthetic photo and checks its hash/reference.
- Full original recovery, survey-to-tender, engineering/QA/handover, development proxy and Poppler PDF regressions remain mandatory.
- CI additionally builds the Docker image without publishing it and confirms startup refuses missing staging configuration and checks the pinned cloudflared binary version without connecting it. Local Docker is unavailable, so container packaging is validated in CI rather than claimed as locally tested.

Commands:

```sh
npm ci
npx playwright install --with-deps chromium
npm run validate
node tests/staging-browser.mjs
docker build --file deploy/staging/Dockerfile --tag jr-owner-staging:review .
```

Need OpenSSL for ephemeral browser test certificates and Poppler for existing PDF tests. `JR_CHROMIUM_PATH` can point to an installed Chromium locally. No cache or artifact storage uploads in CI. Screenshots are synthetic and stay in ignored `artifacts/` unless explicitly included as review evidence.

Live Railway volume/tunnel connectivity, Cloudflare policy/real JWT rotation, physical iPhone Safari, service restart with the mounted volume and off-account backup recovery remain **post-approval release checks**, not completed provider tests. Passing CI does not authorise deployment. Exact-head CI results are linked in the PR.
