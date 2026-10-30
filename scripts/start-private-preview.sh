#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${CODESPACE_NAME:-}" ]]; then
  echo "This launcher is only for a GitHub Codespace." >&2
  exit 1
fi
if [[ ! "$CODESPACE_NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "Invalid Codespaces name." >&2
  exit 1
fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]]; then
  echo "Node.js 24 or newer is required." >&2
  exit 1
fi
echo "Use only fictional project data. Keep port 3000 PRIVATE in the Ports panel."
npm ci
npm run build
if node scripts/check-owner-account.ts; then
  echo "Existing manager account detected; credentials preserved."
else
  status=$?
  if [[ "$status" -ne 1 ]]; then
    echo "Database inspection failed; stopping without changing data." >&2
    exit "$status"
  fi
  echo "Create a private owner login (username: owner)."
  read -r -s -p "Choose password (12+ characters): " password
  echo
  if [[ "${#password}" -lt 12 ]]; then
    echo "Password must have at least 12 characters." >&2
    unset password
    exit 1
  fi
  printf '%s\n' "$password" | node scripts/create-user.ts owner manager
  unset password
fi
echo "Private Codespaces preview: use Ports > 3000 > Open in Browser."
PORT=3000 npm start
