#!/usr/bin/env bash
# ============================================================================
# scripts/deploy.sh
#
# Pull, install, build, migrate, restart. Run as the app user (`icl` by
# default) from $APP_DIR. Safe to re-run.
#
# Required: APP_DIR contains a clone of the repo, .env.local exists with
# DATABASE_URL et al, systemd units have been installed (see
# scripts/install-systemd.sh).
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/indiecomicslive}"
BRANCH="${BRANCH:-main}"

log() { echo -e "\n\033[1;32m[deploy]\033[0m $*"; }

cd "$APP_DIR"

if [ ! -f .env.local ]; then
  echo "ERROR: $APP_DIR/.env.local missing. Copy .env.example and fill it in." >&2
  exit 1
fi

log "git fetch + checkout $BRANCH"
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "npm ci"
npm ci

log "prisma generate + migrate deploy"
npx prisma generate
npx prisma migrate deploy

log "next build"
npm run build

log "reloading systemd units"
sudo systemctl restart indiecomicslive.service
sudo systemctl restart indiecomicslive-ws.service

# Wait a moment then sanity-check
sleep 2
sudo systemctl is-active indiecomicslive.service        | grep -q active || { echo "next failed to start"; sudo journalctl -u indiecomicslive.service -n 50; exit 1; }
sudo systemctl is-active indiecomicslive-ws.service     | grep -q active || { echo "ws failed to start";   sudo journalctl -u indiecomicslive-ws.service -n 50; exit 1; }

log "deployed. Active services:"
sudo systemctl --no-pager status indiecomicslive.service indiecomicslive-ws.service | head -20
