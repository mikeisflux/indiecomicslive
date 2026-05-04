#!/usr/bin/env bash
# ============================================================================
# scripts/turn-server-setup.sh
#
# End-to-end TURN server (coturn) setup for the indiecomicslive.com TURN
# box. Run as root on the TURN box. Idempotent — safe to re-run.
#
# What it does:
#   1. Kills the old streamlick turnserver process if running outside systemd
#   2. Backs up the existing /etc/turnserver.conf
#   3. Installs coturn + certbot if missing
#   4. Verifies DNS is pointing at this box
#   5. Obtains a Let's Encrypt cert via certbot standalone
#   6. Generates a shared secret (or reuses the saved one)
#   7. Writes /etc/turnserver.conf with use-auth-secret mode
#   8. Configures cert permissions + auto-renewal reload hook
#   9. Opens ufw ports
#  10. Starts + enables coturn
#  11. Prints the shared secret for pasting into the app .env.local
#
# Single command to run on the TURN box:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/turn-server-setup.sh | sudo bash
# ============================================================================
set -euo pipefail

# ---- Hardcoded for the indiecomicslive.com TURN box ----
PUBLIC_IPV4="178.156.222.91"
PUBLIC_IPV6="2a01:4ff:f0:5935::1"
TURN_HOST="turn.indiecomicslive.com"
REALM="indiecomicslive.com"
ADMIN_EMAIL="mikeisflux@indiecomicslive.com"
SECRETS_DIR="/root/icl-secrets"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

log() { echo -e "\n\033[1;36m[turn-setup]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Kill any existing turnserver — aggressively
# ---------------------------------------------------------------------------
log "stopping any existing turnserver"

# Streamlick used PM2 to keep turnserver alive — PM2 has its own daemon
# (pm2-root.service) that respawns processes from a saved list, completely
# outside systemd's control. mask + kill the systemd units AND the PM2
# daemon AND wipe PM2's saved process list, otherwise turnserver respawns
# in a fraction of a second.
log "killing PM2 (Streamlick respawn loop) if present"
systemctl stop    pm2-root.service 2>/dev/null || true
systemctl disable pm2-root.service 2>/dev/null || true
systemctl mask    pm2-root.service 2>/dev/null || true
command -v pm2 >/dev/null 2>&1 && pm2 kill 2>/dev/null || true
rm -rf /root/.pm2 /home/*/.pm2 2>/dev/null || true
rm -f /etc/systemd/system/pm2-*.service \
      /etc/systemd/system/multi-user.target.wants/pm2-*.service 2>/dev/null

# Mask + stop every systemd unit that could respawn it. mask symlinks
# the unit to /dev/null so even Restart= directives + socket activation
# can't bring it back. We unmask coturn just before we start it
# ourselves at the end of the script.
for u in coturn.service turnserver.service turn.service coturn.socket; do
  systemctl stop    "$u" 2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
  systemctl mask    "$u" 2>/dev/null || true
done

systemctl daemon-reload

# Make sure psmisc (fuser) is available
command -v fuser >/dev/null 2>&1 || apt-get install -y -qq psmisc >/dev/null 2>&1 || true

# Three rounds of TERM, then SIGKILL, then fuser -k on the bound ports.
for round in 1 2 3; do
  if ! pgrep -f turnserver >/dev/null 2>&1; then break; fi
  pkill -TERM -f turnserver 2>/dev/null || true
  sleep 2
done
pkill -KILL -f turnserver 2>/dev/null || true
sleep 1

for port in 3478 5349; do
  fuser -k -n udp "$port" 2>/dev/null || true
  fuser -k -n tcp "$port" 2>/dev/null || true
done
sleep 2

# Final verification
if ss -tulnH 2>/dev/null | awk '{print $5}' | grep -E ':(3478|5349)$' | grep -q .; then
  echo "ERROR: ports 3478/5349 still bound after kill + mask + PM2 nuke:"
  ss -tulnp | grep -E ':3478|:5349'
  echo
  echo "Look for unusual auto-restart sources:"
  systemctl list-units --no-legend --all | grep -iE 'turn|coturn|pm2' || true
  ls /etc/init.d/ 2>/dev/null | grep -iE 'turn|coturn|pm2' || true
  PID=$(pgrep -f /usr/bin/turnserver | head -1)
  if [ -n "$PID" ]; then
    echo
    echo "cgroup of pid $PID:"
    cat /proc/$PID/cgroup 2>/dev/null
  fi
  exit 1
fi
log "ports 3478 + 5349 are free"

# ---------------------------------------------------------------------------
# 2. Backup existing config
# ---------------------------------------------------------------------------
if [ -f /etc/turnserver.conf ] && [ ! -f /etc/turnserver.conf.streamlick.bak ]; then
  cp /etc/turnserver.conf /etc/turnserver.conf.streamlick.bak
  log "backed up old config to /etc/turnserver.conf.streamlick.bak"
fi

# ---------------------------------------------------------------------------
# 3. Install coturn + certbot if missing
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
if ! command -v turnserver >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  log "installing coturn + certbot + dnsutils"
  apt-get update -y
  apt-get install -y coturn certbot dnsutils ufw openssl
fi

# ---------------------------------------------------------------------------
# 4. DNS check — bail clearly if turn.indiecomicslive.com isn't pointing here
# ---------------------------------------------------------------------------
log "checking DNS for $TURN_HOST"
# Try multiple resolvers — some hosts block 1.1.1.1 outbound
resolve() {
  local kind="$1" name="$2" out=""
  for resolver in 1.1.1.1 8.8.8.8 9.9.9.9 ""; do
    if [ -z "$resolver" ]; then
      out=$(getent ahosts "$name" 2>/dev/null | awk -v k="$kind" '
        k=="A"    && /STREAM/ && $1 !~ ":" {print $1; exit}
        k=="AAAA" && /STREAM/ && $1 ~  ":" {print $1; exit}
      ')
    else
      out=$(dig +short +time=3 +tries=1 -t "$kind" "$name" @"$resolver" 2>/dev/null | tail -1)
    fi
    [ -n "$out" ] && { echo "$out"; return; }
  done
}
RESOLVED_V4="$(resolve A    "$TURN_HOST")"
RESOLVED_V6="$(resolve AAAA "$TURN_HOST")"

if [ "$RESOLVED_V4" != "$PUBLIC_IPV4" ]; then
  cat <<EOF >&2

ERROR: DNS not pointing at this box yet.

  $TURN_HOST  A     resolves to: '$RESOLVED_V4'
                    expected:    '$PUBLIC_IPV4'

Set these records in your DNS provider, wait 1–2 minutes, re-run this script:

  A    $TURN_HOST   $PUBLIC_IPV4
  AAAA $TURN_HOST   $PUBLIC_IPV6

EOF
  exit 1
fi
log "DNS A record OK"
[ -n "$RESOLVED_V6" ] && log "DNS AAAA record: $RESOLVED_V6"

# ---------------------------------------------------------------------------
# 5. Get cert (skip if already issued)
# ---------------------------------------------------------------------------
if [ ! -f "/etc/letsencrypt/live/$TURN_HOST/fullchain.pem" ]; then
  log "obtaining Let's Encrypt cert via standalone (port 80 must be free)"
  ufw allow 80/tcp >/dev/null 2>&1 || true
  certbot certonly --standalone --agree-tos --non-interactive \
    --preferred-challenges http \
    -m "$ADMIN_EMAIL" -d "$TURN_HOST"
else
  log "cert already exists at /etc/letsencrypt/live/$TURN_HOST/"
fi

# ---------------------------------------------------------------------------
# 6. Cert permissions for the turnserver user
# ---------------------------------------------------------------------------
chmod 755 /etc/letsencrypt /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
chown -R turnserver:turnserver \
  "/etc/letsencrypt/live/$TURN_HOST" \
  "/etc/letsencrypt/archive/$TURN_HOST" 2>/dev/null || true

# Auto-renewal hook: re-fix perms + reload coturn after every renewal
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/coturn-reload.sh <<'EOF'
#!/bin/sh
chown -R turnserver:turnserver /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null
systemctl reload coturn 2>/dev/null || systemctl restart coturn
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/coturn-reload.sh

# ---------------------------------------------------------------------------
# 7. Shared secret (generate once, reuse on re-run)
# ---------------------------------------------------------------------------
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [ ! -s "$SECRETS_DIR/turn-shared-secret" ]; then
  openssl rand -base64 32 > "$SECRETS_DIR/turn-shared-secret"
  chmod 600 "$SECRETS_DIR/turn-shared-secret"
  log "generated new shared secret at $SECRETS_DIR/turn-shared-secret"
else
  log "reusing shared secret at $SECRETS_DIR/turn-shared-secret"
fi
TURN_SHARED_SECRET="$(cat "$SECRETS_DIR/turn-shared-secret")"

# ---------------------------------------------------------------------------
# 8. Write /etc/turnserver.conf
# ---------------------------------------------------------------------------
log "writing /etc/turnserver.conf"
cat >/etc/turnserver.conf <<EOF
# /etc/turnserver.conf  —  Indie Comics Live
# Managed by scripts/turn-server-setup.sh — re-run that script to regenerate.

# Network
listening-port=3478
tls-listening-port=5349

# coturn binds 0.0.0.0 + :: by default; advertise the public IPs so
# clients receive reachable candidates.
relay-ip=$PUBLIC_IPV4
external-ip=$PUBLIC_IPV4
relay-ip=$PUBLIC_IPV6
external-ip=$PUBLIC_IPV6

# Auth — REST-API / use-auth-secret pattern.
# This MUST match TURN_SHARED_SECRET in the indiecomicslive .env.
use-auth-secret
static-auth-secret=$TURN_SHARED_SECRET
realm=$REALM

# Performance & safety
fingerprint
no-multicast-peers
no-loopback-peers
no-tcp-relay
no-cli
total-quota=200
user-quota=50
stale-nonce=600

# Relay UDP port range (open these in firewall — the script does it)
min-port=49152
max-port=65535

# TLS
cert=/etc/letsencrypt/live/$TURN_HOST/fullchain.pem
pkey=/etc/letsencrypt/live/$TURN_HOST/privkey.pem

# Logs
log-file=/var/log/coturn/turn.log
simple-log
EOF

mkdir -p /var/log/coturn
chown turnserver:turnserver /var/log/coturn

# Debian's default coturn package ships disabled via /etc/default/coturn
echo "TURNSERVER_ENABLED=1" > /etc/default/coturn

# ---------------------------------------------------------------------------
# 9. Firewall
# ---------------------------------------------------------------------------
log "configuring ufw"
ufw allow 22/tcp                  >/dev/null 2>&1 || true
ufw allow 80/tcp                  >/dev/null 2>&1 || true   # certbot renewal
ufw allow 3478/udp                >/dev/null 2>&1 || true
ufw allow 3478/tcp                >/dev/null 2>&1 || true
ufw allow 5349/udp                >/dev/null 2>&1 || true
ufw allow 5349/tcp                >/dev/null 2>&1 || true
ufw allow 49152:65535/udp         >/dev/null 2>&1 || true
ufw --force enable                >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 10. Disable any legacy auto-launch (rc.local / cron)
# ---------------------------------------------------------------------------
if grep -lE 'turnserver' /etc/rc.local 2>/dev/null | grep -q .; then
  log "stripping turnserver from /etc/rc.local"
  sed -i '/turnserver/d' /etc/rc.local
fi
LEGACY_CRON=$(crontab -l 2>/dev/null | grep -i turnserver || true)
if [ -n "$LEGACY_CRON" ]; then
  log "stripping turnserver from root crontab"
  crontab -l 2>/dev/null | grep -vi turnserver | crontab -
fi

# ---------------------------------------------------------------------------
# 11. Start + verify
# ---------------------------------------------------------------------------
systemctl daemon-reload
# Unmask now that we want to start it ourselves
systemctl unmask coturn.service 2>/dev/null || true
systemctl unmask coturn.socket  2>/dev/null || true
systemctl enable coturn >/dev/null 2>&1
systemctl restart coturn
sleep 3

if ! systemctl is-active --quiet coturn; then
  log "coturn FAILED to start"
  systemctl status coturn --no-pager || true
  journalctl -u coturn -n 50 --no-pager || true
  exit 1
fi

# ---------------------------------------------------------------------------
# Output — what to copy into the app .env.local
# ---------------------------------------------------------------------------
cat <<EOF


================================================================
  TURN server is up — $TURN_HOST
================================================================

Listening sockets (3478 + 5349, UDP+TCP, IPv4+IPv6):

$(ss -tulnp 2>/dev/null | grep -E ':3478|:5349' | head -12)

Paste these into /opt/indiecomicslive/.env.local on the app server:

TURN_HOST=$TURN_HOST
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_REALM=$REALM
TURN_SHARED_SECRET=$TURN_SHARED_SECRET
TURN_TTL_SECONDS=21600

Saved at:  $SECRETS_DIR/turn-shared-secret  (chmod 600)

Verify externally — from another box (your laptop):

  EXP=\$(($(date +%s) + 3600))
  USER="\$EXP:test"
  PASS=\$(echo -n "\$USER" | openssl dgst -sha1 -hmac "$TURN_SHARED_SECRET" -binary | base64)
  turnutils_uclient -v -u "\$USER" -w "\$PASS" -p 3478 $TURN_HOST

Then visit https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
with TURN URL = turn:$TURN_HOST:3478?transport=udp,
plus the same username/password — confirm a 'relay' candidate appears.

EOF
