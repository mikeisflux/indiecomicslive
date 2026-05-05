#!/usr/bin/env bash
# ============================================================================
# scripts/deploy.sh
#
# Pull, install, build, migrate, restart under pm2. Run as the app user
# (`icl` by default) from $APP_DIR. Safe to re-run.
#
# Hardening: the build is verified before pm2 is restarted. If the build
# fails or .next/BUILD_ID is missing, we abort and leave the previous
# version running — no more pm2 thrashing on a missing .next directory.
#
# Required: APP_DIR contains a clone of the repo, .env.local exists with
# DATABASE_URL et al, pm2 processes `indiecomicslive` and
# `indiecomicslive-ws` are already registered (see scripts/install-pm2.sh
# or pm2 ecosystem config).
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/indiecomicslive}"
BRANCH="${BRANCH:-main}"
WEB_PROC="${WEB_PROC:-indiecomicslive}"
WS_PROC="${WS_PROC:-indiecomicslive-ws}"

log() { echo -e "\n\033[1;32m[deploy]\033[0m $*"; }
fail() { echo -e "\n\033[1;31m[deploy]\033[0m $*" >&2; exit 1; }

cd "$APP_DIR"

if [ ! -f .env.local ]; then
  fail ".env.local missing in $APP_DIR. Copy .env.example and fill it in."
fi

if ! grep -q '^SERVER_ACTIONS_ENCRYPTION_KEY=' .env.local; then
  fail "SERVER_ACTIONS_ENCRYPTION_KEY missing from .env.local. Generate with 'openssl rand -base64 32' and set the SAME value on every replica. Without it, every deploy invalidates active browser tabs with 'Failed to find Server Action' errors."
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

log "next build (production)"
if ! npm run build; then
  fail "next build failed. Previous version is still running under pm2. Fix the build, then re-run deploy."
fi

if [ ! -s .next/BUILD_ID ]; then
  fail "build finished without producing .next/BUILD_ID. Refusing to restart pm2."
fi

log "reloading pm2 processes"
# `pm2 reload` does a zero-downtime restart for processes in cluster mode
# and falls back to a normal restart for fork mode. Use it for both.
pm2 reload "$WEB_PROC" --update-env || pm2 restart "$WEB_PROC" --update-env
pm2 reload "$WS_PROC"  --update-env || pm2 restart "$WS_PROC"  --update-env

# Give pm2 a moment to settle, then sanity-check status
sleep 2
pm2 jlist | node -e '
  let raw="";process.stdin.on("data",d=>raw+=d).on("end",()=>{
    const list=JSON.parse(raw);
    const want=["'"$WEB_PROC"'","'"$WS_PROC"'"];
    let ok=true;
    for (const name of want) {
      const p=list.find(x=>x.name===name);
      if (!p) { console.error("MISSING pm2 process:", name); ok=false; continue; }
      const st=p.pm2_env && p.pm2_env.status;
      const restarts=p.pm2_env && p.pm2_env.restart_time;
      if (st!=="online") { console.error(name,"is",st); ok=false; }
      else console.log(name,"online (restarts="+restarts+")");
    }
    if (!ok) process.exit(1);
  });
'

log "deployed."
pm2 status "$WEB_PROC" "$WS_PROC"
