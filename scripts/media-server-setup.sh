#!/usr/bin/env bash
# ============================================================================
# scripts/media-server-setup.sh
#
# Reconfigures the existing Ant Media server (indiecomicslive-media,
# 178.156.200.171) for indiecomicslive.com. Does NOT wipe Ant Media —
# the install stays. Just removes streamlick-deployed apps + cleans up
# co-located streamlick services, sets DNS-correct cert, fixes firewall,
# and prints the panel-side steps you have to do yourself (JWT + webhook).
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/media-server-setup.sh | sudo bash
# ============================================================================
set -uo pipefail
# Note: 'set -e' is intentionally NOT enabled. Glob no-matches and
# best-effort cleanups would kill the script silently on Ubuntu.

PUBLIC_IPV4="178.156.200.171"
STREAM_HOST="stream.indiecomicslive.com"
APP_HOST="indiecomicslive.com"
ADMIN_EMAIL="mikeisflux@indiecomicslive.com"
ANT_MEDIA_DIR="/usr/local/antmedia"
SECRETS_HINT_DIR="/root/icl-secrets"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

log() { echo -e "\n\033[1;35m[media-setup]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Sanity — Ant Media is installed and we are NOT wiping it
# ---------------------------------------------------------------------------
if [ ! -d "$ANT_MEDIA_DIR" ]; then
  cat <<EOF >&2

ERROR: $ANT_MEDIA_DIR does not exist. This script expects a working
Ant Media Server install. If Ant Media is installed somewhere else,
fix ANT_MEDIA_DIR at the top of this script and re-run.

EOF
  exit 1
fi
log "Ant Media install present at $ANT_MEDIA_DIR (keeping)"

# ---------------------------------------------------------------------------
# 2. Wipe co-located streamlick app code (the Streamlick web app, not AMS)
# ---------------------------------------------------------------------------
log "removing streamlick web-app artifacts (Ant Media itself stays)"

mapfile -t SLICK_UNITS < <(systemctl list-unit-files --no-legend 2>/dev/null \
  | awk '{print $1}' | grep -iE 'streamlick|streamlik|stream-?lick' || true)
for u in "${SLICK_UNITS[@]:-}"; do
  [ -z "$u" ] && continue
  log "  stopping + disabling $u"
  systemctl stop "$u"    2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
done
rm -f /etc/systemd/system/*streamlick*.service \
      /etc/systemd/system/multi-user.target.wants/*streamlick*.service 2>/dev/null
systemctl daemon-reload

for d in /opt/streamlick* /var/www/streamlick* /srv/streamlick* /home/streamlick*; do
  [ -e "$d" ] && { log "  rm -rf $d"; rm -rf "$d"; }
done

# Strip from crontab
if crontab -l 2>/dev/null | grep -qi streamlick; then
  crontab -l 2>/dev/null | grep -vi streamlick | crontab -
fi

# Old streamlick certs
for d in /etc/letsencrypt/live/*streamlick* /etc/letsencrypt/archive/*streamlick* /etc/letsencrypt/renewal/*streamlick*; do
  [ -e "$d" ] && rm -rf "$d"
done

# ---------------------------------------------------------------------------
# 3. Wipe streamlick-named Ant Media applications
# ---------------------------------------------------------------------------
# Ant Media apps live under $ANT_MEDIA_DIR/webapps/<AppName>. We want to
# keep WebRTCAppEE (and LiveApp if you use it). Drop anything explicitly
# streamlick-named.
log "removing streamlick-named Ant Media applications (WebRTCAppEE preserved)"
for d in "$ANT_MEDIA_DIR"/webapps/*streamlick* "$ANT_MEDIA_DIR"/webapps/*Streamlick*; do
  [ -e "$d" ] && { log "  rm -rf $d"; rm -rf "$d"; }
done

# Also wipe any old recorded streams from Streamlick under the standard apps.
# Recordings live at $ANT_MEDIA_DIR/webapps/<App>/streams. Take a one-line
# inventory before deleting so you can rollback from snapshot if needed.
for app in WebRTCAppEE LiveApp; do
  d="$ANT_MEDIA_DIR/webapps/$app/streams"
  if [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    log "  clearing old recordings: $d"
    rm -rf "$d"/*
  fi
done

# ---------------------------------------------------------------------------
# 4. Install certbot + dnsutils + ufw if missing
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
if ! command -v certbot >/dev/null 2>&1 || ! command -v dig >/dev/null 2>&1; then
  log "installing certbot + dnsutils + ufw"
  apt-get update -y
  apt-get install -y certbot dnsutils ufw openssl
fi

# ---------------------------------------------------------------------------
# 5. DNS check
# ---------------------------------------------------------------------------
log "checking DNS for $STREAM_HOST"
# Reset DNS resolvers — Hetzner's 185.12.64.1 stays reachable even when
# 1.1.1.1 is blocked outbound.
mkdir -p /etc/systemd/resolved.conf.d
cat >/etc/systemd/resolved.conf.d/icl.conf <<'CONF'
[Resolve]
DNS=185.12.64.1 185.12.64.2 1.1.1.1 8.8.8.8
FallbackDNS=9.9.9.9
DNSStubListener=yes
CONF
systemctl restart systemd-resolved 2>/dev/null || true
cat >/etc/resolv.conf <<'CONF'
nameserver 185.12.64.1
nameserver 185.12.64.2
nameserver 1.1.1.1
CONF

set +e
RESOLVED=""
for r in 185.12.64.1 185.12.64.2 1.1.1.1 8.8.8.8 9.9.9.9; do
  RESOLVED=$(dig +short +time=3 +tries=1 -t A "$STREAM_HOST" @"$r" 2>/dev/null \
             | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' | head -1)
  [ -n "$RESOLVED" ] && break
done
set -e

if [ "$RESOLVED" != "$PUBLIC_IPV4" ]; then
  cat <<EOF >&2

ERROR: DNS not pointing at this box yet.

  $STREAM_HOST  A    resolves to: '$RESOLVED'
                     expected:    '$PUBLIC_IPV4'

Set these records in your DNS provider, wait 1–2 minutes, re-run:

  A     $STREAM_HOST   $PUBLIC_IPV4
  AAAA  $STREAM_HOST   <your IPv6 from \`ip -6 addr\`>

EOF
  exit 1
fi
log "DNS A record OK"

# ---------------------------------------------------------------------------
# 6. Cert (standalone — Ant Media doesn't bind :80 by default)
# ---------------------------------------------------------------------------
if [ ! -f "/etc/letsencrypt/live/$STREAM_HOST/fullchain.pem" ]; then
  log "obtaining Let's Encrypt cert for $STREAM_HOST"
  ufw allow 80/tcp >/dev/null 2>&1 || true

  # Free port 80 — something is binding it (streamlick nginx/apache leftover
  # or Ant Media tomcat reconfigured for :80). Stop common candidates.
  STOPPED_FOR_CERT=()
  for svc in nginx apache2 httpd lighttpd caddy; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      log "  stopping $svc to free :80 for certbot"
      systemctl stop "$svc"
      STOPPED_FOR_CERT+=("$svc")
    fi
  done
  # If something STILL has :80 (e.g. unmanaged process), kill by port
  if ss -tlnH 2>/dev/null | awk '{print $4}' | grep -qE ':80$'; then
    log "  killing remaining :80 listener"
    fuser -k -n tcp 80 2>/dev/null || true
    sleep 2
  fi

  certbot certonly --standalone --agree-tos --non-interactive \
    --preferred-challenges http \
    -m "$ADMIN_EMAIL" -d "$STREAM_HOST"
  CERT_RC=$?

  # Restart anything we stopped
  for svc in "${STOPPED_FOR_CERT[@]:-}"; do
    [ -z "$svc" ] && continue
    log "  restarting $svc"
    systemctl start "$svc" 2>/dev/null || true
  done

  [ "$CERT_RC" -ne 0 ] && exit "$CERT_RC"
fi

# Renewal hook — re-fix Ant Media cert after each renewal.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/antmedia-reload.sh <<EOF
#!/bin/sh
# Convert PEM -> JKS (Ant Media's preferred format), drop into AMS conf
DEST_JKS="$ANT_MEDIA_DIR/conf/fullchain_and_key.p12"
KEYSTORE_PASS="\${ANT_MEDIA_KEYSTORE_PASS:-antmedia}"
openssl pkcs12 -export \\
  -in   /etc/letsencrypt/live/$STREAM_HOST/fullchain.pem \\
  -inkey /etc/letsencrypt/live/$STREAM_HOST/privkey.pem \\
  -name "$STREAM_HOST" \\
  -out  "\$DEST_JKS" \\
  -password pass:"\$KEYSTORE_PASS" 2>/dev/null
chown antmedia:antmedia "\$DEST_JKS" 2>/dev/null
systemctl restart antmedia 2>/dev/null
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/antmedia-reload.sh
# Run it once now to convert the freshly-issued cert
/etc/letsencrypt/renewal-hooks/deploy/antmedia-reload.sh || true

# ---------------------------------------------------------------------------
# 7. Firewall
# ---------------------------------------------------------------------------
log "configuring ufw"
ufw allow 22/tcp                  >/dev/null 2>&1 || true
ufw allow 80/tcp                  >/dev/null 2>&1 || true   # certbot renewals
ufw allow 5443/tcp                >/dev/null 2>&1 || true   # HTTPS / WSS (Ant Media)
ufw allow 5080/tcp                >/dev/null 2>&1 || true   # HTTP (Ant Media admin)
ufw allow 1935/tcp                >/dev/null 2>&1 || true   # RTMP (OBS publish)
ufw allow 50000:60000/udp         >/dev/null 2>&1 || true   # WebRTC media UDP range
ufw --force enable                >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 8. Done — what's left is panel-side
# ---------------------------------------------------------------------------
JWT_HINT=""
WEBHOOK_HINT=""
if [ -f "$SECRETS_HINT_DIR/ant-media-jwt-secret" ]; then
  JWT_HINT="$(cat "$SECRETS_HINT_DIR/ant-media-jwt-secret")"
fi
if [ -f "$SECRETS_HINT_DIR/ant-media-webhook-secret" ]; then
  WEBHOOK_HINT="$(cat "$SECRETS_HINT_DIR/ant-media-webhook-secret")"
fi

cat <<EOF


================================================================
  MEDIA box reconfigured — $STREAM_HOST
================================================================

What was done automatically:
  • Removed all streamlick app artifacts from this box
  • Removed any streamlick-named Ant Media applications
  • Cleared old stream recordings under WebRTCAppEE / LiveApp
  • Got Let's Encrypt cert for $STREAM_HOST
  • Installed certbot renewal hook → repacks cert + restarts Ant Media
  • Opened ufw ports 22 / 80 / 5443 / 5080 / 1935 / 50000-60000

What you still need to do in the Ant Media admin panel:

  Open https://$STREAM_HOST:5443/  (login as admin/admin if untouched —
  CHANGE THE PASSWORD if it's still default)

  Settings → Application → WebRTCAppEE:

  1. JWT Stream Security Settings:
       Enable "Stream Publish JWT Filter"
       Enable "Stream Play JWT Filter"
       JWT Secret = ${JWT_HINT:-<generate / copy from app box /root/icl-secrets/ant-media-jwt-secret>}

  2. Stream Webhook:
       URL    = https://$APP_HOST/api/webhooks/antmedia
       Secret = ${WEBHOOK_HINT:-<generate / copy from app box /root/icl-secrets/ant-media-webhook-secret>}

  3. Click "Save" and "Restart" the application.

  4. Disable / delete any non-WebRTCAppEE applications you don't use.

After the panel changes are saved, on the app box visit
/admin/settings — the Ant Media card should turn green.

EOF
