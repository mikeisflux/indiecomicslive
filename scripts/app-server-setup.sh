#!/usr/bin/env bash
# ============================================================================
# scripts/app-server-setup.sh
#
# STEP 1 of the production deploy. Run on the fresh app box
# (IndieComicsLive-Prod, 157.180.39.56). Idempotent — safe to re-run.
#
# What this does (no questions, no prompts):
#   1. apt update + install Node 22, nginx, certbot, ufw, postgres-client, etc.
#   2. Creates the `icl` system user and /opt/indiecomicslive layout
#   3. Configures ufw (22/80/443 + sane defaults)
#   4. Installs the bot-blocker watcher (systemd + cron)
#   5. Clones the repo at /opt/indiecomicslive on the right branch
#   6. Generates every secret that can be auto-generated, stashes them
#      in /root/icl-secrets/ (chmod 600) AND writes /opt/indiecomicslive/.env.local
#      with placeholders for the values that have to come from external services
#   7. Prints a checklist of what you need to fill in next + the next command
#      to run (scripts/app-server-finalize.sh).
#
# Single command to run on the box:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/app-server-setup.sh | sudo bash
# ============================================================================
set -euo pipefail

# ---- Hardcoded for this deploy ----
APP_HOST="indiecomicslive.com"
APP_USER="icl"
APP_DIR="/opt/indiecomicslive"
NODE_MAJOR="22"
ADMIN_EMAIL="mikeisflux@indiecomicslive.com"
SECRETS_DIR="/root/icl-secrets"
GIT_REPO="https://github.com/mikeisflux/indiecomicslive.git"
GIT_BRANCH="claude/whatnot-clone-exploration-VxA1W"
ANT_MEDIA_HOST="stream.indiecomicslive.com"
TURN_HOST="turn.indiecomicslive.com"
PUBLIC_IPV4="157.180.39.56"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

log() { echo -e "\n\033[1;34m[setup]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 0. Wipe streamlick + old database (this box was a streamlick app server)
# ---------------------------------------------------------------------------
log "Phase 0 — wiping streamlick artifacts"

# Stop + disable any streamlick services (case-insensitive match)
mapfile -t SLICK_UNITS < <(systemctl list-unit-files --no-legend 2>/dev/null \
  | awk '{print $1}' | grep -iE 'streamlick|streamlik|stream-?lick' || true)
for u in "${SLICK_UNITS[@]:-}"; do
  [ -z "$u" ] && continue
  log "  stopping + disabling $u"
  systemctl stop "$u"    2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
done

# Remove streamlick systemd unit files
rm -f /etc/systemd/system/*streamlick*.service \
      /etc/systemd/system/multi-user.target.wants/*streamlick*.service \
      /lib/systemd/system/*streamlick*.service 2>/dev/null || true
systemctl daemon-reload

# Remove streamlick application directories
for d in /opt/streamlick* /var/www/streamlick* /srv/streamlick* /home/streamlick*; do
  if [ -e "$d" ]; then
    log "  rm -rf $d"
    rm -rf "$d"
  fi
done

# Catch-all: anything else streamlick-named under common locations
mapfile -t SLICK_LEFTOVERS < <(find /opt /var/www /srv /etc/nginx /etc/systemd /etc/cron.d /home /root \
  -maxdepth 4 -iname '*streamlick*' 2>/dev/null || true)
for f in "${SLICK_LEFTOVERS[@]:-}"; do
  [ -z "$f" ] && continue
  log "  rm -rf $f"
  rm -rf "$f"
done

# Remove streamlick nginx sites + reset to clean state
rm -f /etc/nginx/sites-available/*streamlick* /etc/nginx/sites-enabled/*streamlick* 2>/dev/null
rm -f /etc/nginx/sites-enabled/default 2>/dev/null

# Strip streamlick lines from root crontab
if crontab -l 2>/dev/null | grep -qi streamlick; then
  log "  stripping streamlick from root crontab"
  crontab -l 2>/dev/null | grep -vi streamlick | crontab -
fi

# Drop the old database (local Postgres was streamlick's). The new app
# uses an external DATABASE_URL (Neon / managed), so we don't need a
# local Postgres on this box.
if systemctl list-units --type=service --all 2>/dev/null | grep -qE '^\s*postgresql'; then
  log "  wiping local Postgres (was streamlick's)"
  systemctl stop postgresql 2>/dev/null || true
  systemctl disable postgresql 2>/dev/null || true
  apt-get purge -y 'postgresql*' 2>/dev/null || true
  apt-get autoremove -y 2>/dev/null || true
  rm -rf /var/lib/postgresql /etc/postgresql /var/log/postgresql
fi

# Drop Redis if streamlick used it (we don't)
if systemctl is-active --quiet redis-server 2>/dev/null \
   || systemctl is-active --quiet redis 2>/dev/null; then
  log "  wiping local Redis"
  systemctl stop redis-server redis 2>/dev/null || true
  apt-get purge -y 'redis*' 2>/dev/null || true
  rm -rf /var/lib/redis /etc/redis /var/log/redis
fi

# Remove the streamlick user if one existed
if id streamlick >/dev/null 2>&1; then
  log "  userdel streamlick"
  pkill -u streamlick 2>/dev/null || true
  sleep 1
  userdel -rf streamlick 2>/dev/null || true
fi

# Old Let's Encrypt certs for streamlick hostnames — orphan files only,
# the hostname itself is going away. Snapshot already covers rollback.
for d in /etc/letsencrypt/live/*streamlick* /etc/letsencrypt/archive/*streamlick* /etc/letsencrypt/renewal/*streamlick*; do
  [ -e "$d" ] || continue
  log "  rm -rf $d"
  rm -rf "$d"
done

log "Phase 0 done — streamlick artifacts removed"

# ---------------------------------------------------------------------------
# 1. apt + base packages
# ---------------------------------------------------------------------------
log "apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  curl ca-certificates gnupg git build-essential ufw \
  nginx certbot python3-certbot-nginx \
  postgresql-client iptables logrotate jq htop unzip dnsutils openssl

# ---------------------------------------------------------------------------
# 2. Node.js
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

mkdir -p /var/log/indiecomicslive "$SECRETS_DIR"
chown -R "$APP_USER:$APP_USER" /var/log/indiecomicslive
chmod 700 "$SECRETS_DIR"

# Bot-blocker pending file owned by the app user
touch /tmp/botblock-pending
chown "$APP_USER:$APP_USER" /tmp/botblock-pending
chmod 0644 /tmp/botblock-pending

# ---------------------------------------------------------------------------
# 4. Firewall
# ---------------------------------------------------------------------------
log "configuring ufw"
ufw default deny incoming  >/dev/null 2>&1 || true
ufw default allow outgoing >/dev/null 2>&1 || true
ufw allow 22/tcp           >/dev/null 2>&1 || true
ufw allow 80/tcp           >/dev/null 2>&1 || true
ufw allow 443/tcp          >/dev/null 2>&1 || true
ufw --force enable         >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 5. Clone repo
# ---------------------------------------------------------------------------
if [ ! -d "$APP_DIR/.git" ]; then
  log "cloning $GIT_REPO into $APP_DIR ($GIT_BRANCH)"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git clone --branch "$GIT_BRANCH" "$GIT_REPO" "$APP_DIR"
else
  log "repo exists; fetching latest on $GIT_BRANCH"
  cd "$APP_DIR"
  sudo -u "$APP_USER" git fetch --all --prune
  sudo -u "$APP_USER" git checkout "$GIT_BRANCH"
  sudo -u "$APP_USER" git pull --ff-only origin "$GIT_BRANCH"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------------------------------------------------------------------------
# 6. Bot blocker (uses helpfulapps/botblock-firewall/ from the repo)
# ---------------------------------------------------------------------------
log "installing bot-blocker firewall"
install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-watcher.sh" /usr/local/bin/botblock-watcher
install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-sync.sh"    /usr/local/bin/botblock-sync
install -m 0755 "$APP_DIR/helpfulapps/botblock-firewall/botblock-manual.sh"  /usr/local/bin/botblock-manual
install -m 0644 "$APP_DIR/helpfulapps/botblock-firewall/botblock-watcher.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now botblock-watcher

# /etc/default/botblock-sync stub (filled in once DATABASE_URL exists)
if [ ! -f /etc/default/botblock-sync ]; then
  cat >/etc/default/botblock-sync <<EOF
# Filled in by scripts/app-server-finalize.sh from DATABASE_URL.
PG_HOST=
PG_USER=
PG_PASS=
PG_DB=
EOF
  chmod 600 /etc/default/botblock-sync
fi

if ! crontab -l 2>/dev/null | grep -q botblock-sync; then
  (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1") | crontab -
fi

# ---------------------------------------------------------------------------
# 7. Logrotate
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

# ---------------------------------------------------------------------------
# 8. Auto-generate secrets (idempotent: only creates if missing)
# ---------------------------------------------------------------------------
log "generating secrets in $SECRETS_DIR (only if missing)"
gen_secret() {
  local name="$1"
  local file="$SECRETS_DIR/$name"
  if [ ! -s "$file" ]; then
    openssl rand -base64 32 > "$file"
    chmod 600 "$file"
  fi
  cat "$file"
}

AUTH_SECRET="$(gen_secret auth-secret)"
BANK_ACCOUNT_ENCRYPTION_KEY="$(gen_secret bank-account-encryption-key)"
ANT_MEDIA_JWT_SECRET="$(gen_secret ant-media-jwt-secret)"
ANT_MEDIA_WEBHOOK_SECRET="$(gen_secret ant-media-webhook-secret)"
NMI_WEBHOOK_SECRET="$(gen_secret nmi-webhook-secret)"

# ---------------------------------------------------------------------------
# 9. Write .env.local with auto-secrets + placeholders for the rest
# ---------------------------------------------------------------------------
ENV_FILE="$APP_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  log "writing $ENV_FILE skeleton (auto-secrets filled, externals as TODO)"
  cat >"$ENV_FILE" <<EOF
# Indie Comics Live — production env
# Generated by scripts/app-server-setup.sh on $(date -u +%FT%TZ)
# Auto-generated values are filled in. TODO_* placeholders need real values.

NEXT_PUBLIC_SITE_URL=https://$APP_HOST

# === Postgres (Neon, Supabase, RDS, or self-hosted) ===
DATABASE_URL=TODO_DATABASE_URL

# === Auth.js ===
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=https://$APP_HOST

# === Email (SendGrid) ===
AUTH_SENDGRID_KEY=TODO_SENDGRID_API_KEY
AUTH_EMAIL_FROM=noreply@$APP_HOST

# === Ant Media Server ===
# JWT + webhook secrets are auto-generated here. You MUST paste the SAME
# values into the Ant Media admin panel:
#   Settings → Application → WebRTCAppEE → JWT Stream Security Settings
#   Settings → Application → WebRTCAppEE → Stream Webhook URL + Secret
ANT_MEDIA_HOST=$ANT_MEDIA_HOST
ANT_MEDIA_PORT=5443
ANT_MEDIA_APP=WebRTCAppEE
ANT_MEDIA_JWT_SECRET=$ANT_MEDIA_JWT_SECRET
ANT_MEDIA_WEBHOOK_SECRET=$ANT_MEDIA_WEBHOOK_SECRET
ANT_MEDIA_REST_USER=TODO_ANT_MEDIA_PANEL_USER
ANT_MEDIA_REST_PASS=TODO_ANT_MEDIA_PANEL_PASS
NEXT_PUBLIC_ANT_MEDIA_APP=WebRTCAppEE

# === PaymentCloud / NMI ===
# securityKey + publicKey from the PaymentCloud merchant portal.
# webhookSecret is auto-generated; paste it into the merchant portal too.
NMI_SECURITY_KEY=TODO_NMI_SECURITY_KEY
NMI_PUBLIC_KEY=TODO_NMI_PUBLIC_KEY
NMI_WEBHOOK_SECRET=$NMI_WEBHOOK_SECRET
NMI_ENVIRONMENT=production

# === Cloudflare R2 ===
R2_ACCOUNT_ID=TODO_R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=TODO_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=TODO_R2_SECRET_ACCESS_KEY
R2_BUCKET=indiecomicslive
R2_PUBLIC_URL=TODO_R2_PUBLIC_URL

# === TURN (coturn) ===
# TURN_SHARED_SECRET must match the value in /root/icl-secrets/turn-shared-secret
# on the TURN box (set by scripts/turn-server-setup.sh).
TURN_HOST=$TURN_HOST
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_REALM=$APP_HOST
TURN_SHARED_SECRET=TODO_TURN_SHARED_SECRET
TURN_TTL_SECONDS=21600

# === Encryption-at-rest for seller bank-account PII ===
BANK_ACCOUNT_ENCRYPTION_KEY=$BANK_ACCOUNT_ENCRYPTION_KEY

# === WebSocket server ===
WS_PORT=3001
NEXT_PUBLIC_WS_URL=wss://$APP_HOST/ws
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  log "$ENV_FILE already exists — leaving it alone"
fi

# ---------------------------------------------------------------------------
# 10. Output — what you need to do next
# ---------------------------------------------------------------------------
cat <<EOF


================================================================
  STEP 1 COMPLETE — IndieComicsLive-Prod is bootstrapped
================================================================

What got installed on this box:
  • Node $(node -v) + npm $(npm -v)
  • nginx, certbot, ufw (ports 22/80/443 open)
  • postgres-client, dnsutils, jq, openssl
  • bot-blocker watcher (systemd, running)
  • Repo at $APP_DIR (branch $GIT_BRANCH)

Auto-generated secrets (saved in $SECRETS_DIR/, also in .env.local):
  • AUTH_SECRET
  • BANK_ACCOUNT_ENCRYPTION_KEY
  • ANT_MEDIA_JWT_SECRET            ← also paste into Ant Media panel
  • ANT_MEDIA_WEBHOOK_SECRET        ← also paste into Ant Media panel
  • NMI_WEBHOOK_SECRET              ← also paste into PaymentCloud portal

================================================================
  WHAT YOU NEED TO DO BEFORE RUNNING STEP 2
================================================================

A. DNS — set these in your DNS provider:
     A     $APP_HOST          $PUBLIC_IPV4
     AAAA  $APP_HOST          $(ip -6 addr show | grep -oE '2a01:4f9:c013:7e00::[0-9a-f]+' | head -1)
     CNAME www.$APP_HOST      $APP_HOST

B. Postgres — provision a DB. Recommended: Neon (free tier, 60 sec).
   Copy the connection string ("postgres://user:pass@host/db?sslmode=require")
   and paste it into:
     $ENV_FILE   →  DATABASE_URL=

C. SendGrid — verify $APP_HOST as a sender domain, get an API key.
     $ENV_FILE   →  AUTH_SENDGRID_KEY=

D. PaymentCloud — from the merchant portal:
     NMI_SECURITY_KEY  =  <Security Key from API tab>
     NMI_PUBLIC_KEY    =  <Tokenization Key for CollectJS>
   Then in the portal, set Webhook URL to:
     https://$APP_HOST/api/webhooks/nmi
   Webhook Secret:
$(cat $SECRETS_DIR/nmi-webhook-secret)

E. R2 — Cloudflare dashboard → R2 → indiecomicslive bucket → API tokens:
     R2_ACCOUNT_ID
     R2_ACCESS_KEY_ID
     R2_SECRET_ACCESS_KEY
     R2_PUBLIC_URL  (e.g. https://pub-xxxxx.r2.dev)

F. Ant Media — open https://$ANT_MEDIA_HOST:5443/ → Settings → Application
   → WebRTCAppEE:
     • JWT Stream Security Settings → Secret =
$(cat $SECRETS_DIR/ant-media-jwt-secret)
     • Stream Webhook URL = https://$APP_HOST/api/webhooks/antmedia
     • Stream Webhook Secret =
$(cat $SECRETS_DIR/ant-media-webhook-secret)
     • Save + Restart the application
   Also fill into .env.local:
     ANT_MEDIA_REST_USER  = <panel admin username>
     ANT_MEDIA_REST_PASS  = <panel admin password>

G. TURN — on the TURN box, you should already have run
   scripts/turn-server-setup.sh. Grab the shared secret:
     ssh root@<turn box>  cat /root/icl-secrets/turn-shared-secret
   And paste into:
     $ENV_FILE   →  TURN_SHARED_SECRET=

================================================================
  WHEN ALL OF A–G ARE DONE — RUN STEP 2:
================================================================

  sudo bash $APP_DIR/scripts/app-server-finalize.sh

Step 2 will: validate $ENV_FILE, install nginx site + systemd units,
get the Let's Encrypt cert, run prisma migrate, build, start the app
and WS server, then promote $ADMIN_EMAIL to super_admin.

EOF
