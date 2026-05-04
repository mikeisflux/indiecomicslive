#!/usr/bin/env bash
# ============================================================================
# scripts/install-systemd.sh
#
# Copies the bundled systemd units + nginx site into place, enables them,
# and provisions the SSL cert. Run as root after scripts/setup-server.sh
# and an initial git clone into $APP_DIR.
# ============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2; exit 1
fi

APP_DIR="${APP_DIR:-/opt/indiecomicslive}"
APP_HOST="${APP_HOST:-indiecomicslive.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-mikeisflux@indiecomicslive.com}"

log() { echo -e "\n\033[1;33m[install-systemd]\033[0m $*"; }

# ---- systemd units ----
log "installing systemd units"
install -m 0644 "$APP_DIR/helpfulapps/systemd/indiecomicslive.service"     /etc/systemd/system/
install -m 0644 "$APP_DIR/helpfulapps/systemd/indiecomicslive-ws.service"  /etc/systemd/system/
systemctl daemon-reload
systemctl enable indiecomicslive.service indiecomicslive-ws.service

# ---- nginx site ----
log "installing nginx site for $APP_HOST"
sed "s/__APP_HOST__/$APP_HOST/g" \
  "$APP_DIR/helpfulapps/nginx/indiecomicslive.conf" \
  > /etc/nginx/sites-available/indiecomicslive.conf

ln -sf /etc/nginx/sites-available/indiecomicslive.conf /etc/nginx/sites-enabled/indiecomicslive.conf
rm -f /etc/nginx/sites-enabled/default

# ---- SSL via Let's Encrypt ----
if [ ! -f "/etc/letsencrypt/live/$APP_HOST/fullchain.pem" ]; then
  log "obtaining cert for $APP_HOST + www.$APP_HOST"
  systemctl reload nginx || systemctl start nginx
  certbot --nginx --non-interactive --agree-tos -m "$ADMIN_EMAIL" \
    -d "$APP_HOST" -d "www.$APP_HOST"
fi

nginx -t
systemctl reload nginx

log "done. Start the app: systemctl start indiecomicslive.service indiecomicslive-ws.service"
