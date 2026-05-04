#!/usr/bin/env bash
# ============================================================================
# scripts/app-server-finalize.sh
#
# STEP 2 of the production deploy. Run after scripts/app-server-setup.sh
# AND after you've filled in the TODO_ values in /opt/indiecomicslive/.env.local.
#
# What it does:
#   1. Refuses to proceed if .env.local still has any TODO_ placeholders
#   2. Refuses to proceed if DNS isn't pointing at this box yet
#   3. Templates + installs the nginx site, runs certbot --nginx
#   4. Auto-fills /etc/default/botblock-sync from DATABASE_URL
#   5. Installs the systemd units, runs the first deploy
#   6. Promotes mikeisflux@indiecomicslive.com to super_admin
#
# Single command:
#   sudo bash /opt/indiecomicslive/scripts/app-server-finalize.sh
# ============================================================================
set -euo pipefail

APP_HOST="indiecomicslive.com"
APP_USER="icl"
APP_DIR="/opt/indiecomicslive"
ADMIN_EMAIL="mikeisflux@indiecomicslive.com"
ENV_FILE="$APP_DIR/.env.local"
PUBLIC_IPV4="157.180.39.56"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

log() { echo -e "\n\033[1;33m[finalize]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Validate .env.local — no TODO_ placeholders allowed
# ---------------------------------------------------------------------------
if ! [ -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE missing. Run app-server-setup.sh first." >&2
  exit 1
fi
TODOS=$(grep -E '=TODO_' "$ENV_FILE" || true)
if [ -n "$TODOS" ]; then
  echo "ERROR: $ENV_FILE still has TODO placeholders:" >&2
  echo "$TODOS" >&2
  echo "Fill those in before running finalize." >&2
  exit 1
fi
log "$ENV_FILE has no TODO placeholders — good"

# ---------------------------------------------------------------------------
# 2. Validate DNS
# ---------------------------------------------------------------------------
log "checking DNS for $APP_HOST"
RESOLVED=$(dig +short -t A "$APP_HOST" @1.1.1.1 | tail -1)
if [ "$RESOLVED" != "$PUBLIC_IPV4" ]; then
  cat <<EOF >&2

ERROR: $APP_HOST resolves to '$RESOLVED', expected '$PUBLIC_IPV4'.
Set the DNS A record and wait for propagation, then re-run.

EOF
  exit 1
fi
log "DNS OK"

# ---------------------------------------------------------------------------
# 3. Auto-fill /etc/default/botblock-sync from DATABASE_URL
# ---------------------------------------------------------------------------
log "deriving Postgres creds from DATABASE_URL"
# shellcheck disable=SC1090
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
# postgres://user:pass@host:port/db?...
if [[ "$DATABASE_URL" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:/]+)(:[0-9]+)?/([^?]+) ]]; then
  PG_USER="${BASH_REMATCH[2]}"
  PG_PASS="${BASH_REMATCH[3]}"
  PG_HOST="${BASH_REMATCH[4]}"
  PG_DB="${BASH_REMATCH[6]}"
  cat >/etc/default/botblock-sync <<EOF
PG_HOST=$PG_HOST
PG_USER=$PG_USER
PG_PASS=$PG_PASS
PG_DB=$PG_DB
EOF
  chmod 600 /etc/default/botblock-sync
  log "wrote /etc/default/botblock-sync"
else
  log "WARNING: could not parse DATABASE_URL; /etc/default/botblock-sync left blank"
  log "         (botblock-sync cron will skip until you fix it manually)"
fi

# ---------------------------------------------------------------------------
# 4. systemd units + nginx site + cert
# ---------------------------------------------------------------------------
log "installing systemd units"
install -m 0644 "$APP_DIR/helpfulapps/systemd/indiecomicslive.service"     /etc/systemd/system/
install -m 0644 "$APP_DIR/helpfulapps/systemd/indiecomicslive-ws.service"  /etc/systemd/system/
systemctl daemon-reload
systemctl enable indiecomicslive.service indiecomicslive-ws.service

log "installing nginx site for $APP_HOST"
sed "s/__APP_HOST__/$APP_HOST/g" \
  "$APP_DIR/helpfulapps/nginx/indiecomicslive.conf" \
  > /etc/nginx/sites-available/indiecomicslive.conf
ln -sf /etc/nginx/sites-available/indiecomicslive.conf /etc/nginx/sites-enabled/indiecomicslive.conf
rm -f /etc/nginx/sites-enabled/default

if [ ! -f "/etc/letsencrypt/live/$APP_HOST/fullchain.pem" ]; then
  log "obtaining cert for $APP_HOST + www.$APP_HOST"
  systemctl reload nginx 2>/dev/null || systemctl start nginx
  certbot --nginx --non-interactive --agree-tos -m "$ADMIN_EMAIL" \
    -d "$APP_HOST" -d "www.$APP_HOST"
fi

nginx -t
systemctl reload nginx

# ---------------------------------------------------------------------------
# 5. First deploy: install, prisma migrate, build, start
# ---------------------------------------------------------------------------
log "running first deploy as $APP_USER"
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npx prisma generate
sudo -u "$APP_USER" npx prisma migrate deploy
sudo -u "$APP_USER" npm run build

systemctl restart indiecomicslive.service indiecomicslive-ws.service
sleep 3

if ! systemctl is-active --quiet indiecomicslive.service; then
  log "indiecomicslive.service FAILED to start"
  systemctl status indiecomicslive.service --no-pager
  journalctl -u indiecomicslive.service -n 60 --no-pager
  exit 1
fi
if ! systemctl is-active --quiet indiecomicslive-ws.service; then
  log "indiecomicslive-ws.service FAILED to start"
  systemctl status indiecomicslive-ws.service --no-pager
  journalctl -u indiecomicslive-ws.service -n 60 --no-pager
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Promote admin user (only works after they've signed in once via magic link)
# ---------------------------------------------------------------------------
log "checking if $ADMIN_EMAIL has signed in yet"
if sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npx tsx scripts/grant-admin.ts $ADMIN_EMAIL super" 2>/dev/null; then
  log "$ADMIN_EMAIL promoted to super_admin"
else
  cat <<EOF

NOTE: $ADMIN_EMAIL hasn't signed in yet, so we can't promote them yet.
After cert + nginx are live, do this:

  1. Visit https://$APP_HOST → Sign in → enter $ADMIN_EMAIL
  2. Click the magic link in your email
  3. Pick a handle when prompted
  4. Then on this box, run:

     cd $APP_DIR
     sudo -u $APP_USER npx tsx scripts/grant-admin.ts $ADMIN_EMAIL super

EOF
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
cat <<EOF


================================================================
  STEP 2 COMPLETE — https://$APP_HOST is live
================================================================

Services:
  $(systemctl is-active indiecomicslive.service        | sed 's/^/  app:    /')
  $(systemctl is-active indiecomicslive-ws.service     | sed 's/^/  ws:     /')
  $(systemctl is-active botblock-watcher.service       | sed 's/^/  botblk: /')
  $(systemctl is-active nginx.service                  | sed 's/^/  nginx:  /')

Verify:
  curl -I https://$APP_HOST
  https://$APP_HOST/admin/settings   (after sign-in + handle pick + grant-admin)

Tail logs:
  journalctl -u indiecomicslive.service -f
  tail -f /var/log/indiecomicslive/app.log
  tail -f /var/log/indiecomicslive/ws.log

EOF
