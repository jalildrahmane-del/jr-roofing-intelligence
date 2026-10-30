# Private browser preview — GitHub Codespaces (not a production deployment)

This is an optional, owner-operated staging preview. It has **not** been deployed. It uses the existing Node/SQLite app and no additional AI API key. GitHub Codespaces usage may count toward your quota; verify billing and configure a zero-spend budget before creating one.

1. In GitHub, open branch `feature/owner-command-centre-expansion` in `jalildrahmane-del/jr-roofing-intelligence`.
2. Select **Code > Codespaces > Create codespace on this branch**. This starts a cloud environment and may consume billable usage; only do this after checking your budget.
3. In the terminal, run `bash scripts/start-private-preview.sh`. Choose your own password; never paste it into chat.
4. Open the **Ports** tab. Verify port **3000** visibility is **Private**, not Public. Open its forwarded HTTPS URL. Sign in as `owner`.
5. To review on your phone, open the same private HTTPS URL while signed in to your GitHub account. The Codespace must be running; GitHub may ask you to authenticate again.
6. Stop the Codespace after reviewing to reduce compute usage. Keep a backup before deleting it; the SQLite database lives inside the Codespace and may be lost if the Codespace is deleted.

Security: the server accepts only localhost or the exact current Codespaces forwarded hostname. It uses Secure cookies on the forwarded host and same-origin POST checks. GitHub's private port authentication is an additional gate. **Never make port 3000 Public**. Use fictional data only, and do not treat this as approved production hosting. Do not share a forwarded URL with others expecting it to grant them access: private forwarding is tied to the owner.

Limitations: temporary environment, not always-on hosting, no automatic backups, no shared user-access provisioning, and no production security acceptance. A separate hosting/security design is needed before inviting staff or using real project data.
