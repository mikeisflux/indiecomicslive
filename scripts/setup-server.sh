#!/usr/bin/env bash
# ============================================================================
# scripts/setup-server.sh
#
# One-shot bootstrap for a fresh app server. Run this once after wiping
# the old Streamlick app box. Idempotent — safe to re-run.
#
# Tested on Ubuntu 22.04 / 24.04 LTS.
#
# Usage (as root, or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/main/scripts/setup-server.sh | sudo bash
#   # OR after `git clone`:
#   sudo bash scripts/setup-server.sh
# ============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "must run as root (use sudo)" >&2
  exit 1
fi

APP_USER="${APP_USER:-icl}"
APP_DIR="${APP_DIR:-/opt/indiecomicslive}"
NODE_MAJOR="${NODE_MAJOR:-22}"

log() { echo -e "\n\033[1;34m[setup]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Base packages
# ---------------------------------------------------------------------------
log "apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  curl ca-certificates gnupg git build-essential ufw \
  nginx certbot python3-certbot-nginx \
  postgresql-client iptables logrotate jq htop unzip

# ---------------------------------------------------------------------------
# 2. Node.js (NodeSource LTS)
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || \
   [ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]; then
  log "installing Node.js $NODE_MAJOR.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
log "node $(node -v) / npm $(npm -v)"

# ---------------------------------------------------------------------------
# 3. App user + dirs
# ---------------------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  log "creating user $APP_USER"
  useradd -m -s /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR" /var/log/indiecomicslive
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/log/indiecomicslive

# Make sure the bot-blocker pending file exists with correct perms
touch /tmp/botblock-pending
chown "$APP_USER:$APP_USER" /tmp/botblock-pending
chmod 0644 /tmp/botblock-pending

# ---------------------------------------------------------------------------
# 4. Firewall
# ---------------------------------------------------------------------------
log "configuring ufw"
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http (cert + redirect)'
ufw allow 443/tcp comment 'https'
ufw --force enable

# ---------------------------------------------------------------------------
# 5. Bot blocker (helpful apps)
# ---------------------------------------------------------------------------
if [ -f "$APP_DIR/helpfulapps/botblock-firewall/botblock-watcher.sh" ]; then
  log "installing bot-blocker firewall scripts"
  install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-watcher.sh" /usr/local/bin/botblock-watcher
  install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-sync.sh"    /usr/local/bin/botblock-sync
  install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-manual.sh"  /usr/local/bin/botblock-manual
  install -m 0644 "$APP_DIR/helpfulapps/botblock-firewall/botblock-watcher.service" /etc/systemd/system/

  systemctl daemon-reload
  systemctl enable --now botblock-watcher

  if [ ! -f /etc/default/botblock-sync ]; then
    log "writing /etc/default/botblock-sync stub — EDIT THE PG CREDENTIALS"
    cat >/etc/default/botblock-sync <<'EOF'
# /etc/default/botblock-sync — read by /usr/local/bin/botblock-sync
PG_HOST=localhost
PG_USER=indiecomicslive
PG_PASS=
PG_DB=indiecomicslive
EOF
    chmod 600 /etc/default/botblock-sync
  fi

  # Cron for the 5-minute sync (idempotent — only adds if missing)
  if ! crontab -l 2>/dev/null | grep -q botblock-sync; then
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1") | crontab -
  fi
fi

# ---------------------------------------------------------------------------
# 6. Logrotate
# ---------------------------------------------------------------------------
cat >/etc/logrotate.d/indiecomicslive <<'EOF'
/var/log/indiecomicslive/*.log /var/log/botblock*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  create 0640 root root
  sharedscripts
}
EOF

log "done. Next: cd $APP_DIR && sudo -u $APP_USER bash scripts/deploy.sh"
