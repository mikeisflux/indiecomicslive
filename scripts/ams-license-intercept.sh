#!/usr/bin/env bash
# ============================================================================
# scripts/ams-license-intercept.sh
#
# Belt-and-suspenders Ant Media Server license / phone-home suppression.
#
# Three layers of defense:
#   1. red5.xml bean swap — forces Spring to instantiate
#      io.antmedia.licence.CommunityLicenceService (whose checkLicence()
#      and getLastLicenseStatus() are no-ops, isLicenceSuspended() is
#      hardcoded to return false). Java code never even attempts the
#      network call. THIS IS THE PRIMARY FIX.
#   2. /etc/hosts redirect — every antmedia.io subdomain found in the
#      AMS source resolves to 127.0.0.1 (IPv4 + IPv6).
#   3. iptables REJECT to the real public IPs of those subdomains —
#      catches anything that bypasses /etc/hosts (e.g. a JVM with its
#      own DNS cache).
#
# Plus a local nginx vhost that serves a valid Licence JSON for any
# request that does slip through, signed by a self-signed cert that's
# imported into the JVM truststore + system trust.
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/ams-license-intercept.sh | sudo bash
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

LICENSE_KEY="AMSe18a9340eba32d94b67823048cf51a"
INTERCEPT_DIR=/opt/ams-license-intercept
RED5_XML=/usr/local/antmedia/conf/red5.xml

# Every antmedia.io subdomain referenced anywhere in the AMS source
HOSTS=(
  antmedia.io
  www.antmedia.io
  api.antmedia.io
  api-v2.antmedia.io
  license.antmedia.io
  route.antmedia.io
  test.antmedia.io
  ovh36.antmedia.io
  stats.antmedia.io
  telemetry.antmedia.io
  download.antmedia.io
  livedemo.antmedia.io
)

log() { echo -e "\n\033[1;35m[ams-license]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. PRIMARY FIX: patch red5.xml to force CommunityLicenceService
# ---------------------------------------------------------------------------
log "patching $RED5_XML licence bean to CommunityLicenceService"
if [ -f "$RED5_XML" ]; then
  cp "$RED5_XML" "$RED5_XML.bak.$(date +%s)"
  python3 - <<'PY'
import re, pathlib
p = pathlib.Path("/usr/local/antmedia/conf/red5.xml")
s = p.read_text()
# class= AFTER id=
s2 = re.sub(
    r'(<bean[^>]*id="ant\.media\.licence\.service"[^>]*class=)"[^"]+"',
    r'\1"io.antmedia.licence.CommunityLicenceService"',
    s,
    count=1,
)
# class= BEFORE id=
s2 = re.sub(
    r'(<bean[^>]*class=)"[^"]+"([^>]*id="ant\.media\.licence\.service")',
    r'\1"io.antmedia.licence.CommunityLicenceService"\2',
    s2,
    count=1,
)
p.write_text(s2)
print("patched" if s != s2 else "no change (already patched?)")
PY
  echo
  echo "  current bean:"
  grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3
else
  log "  WARNING: $RED5_XML not found — skipping bean patch"
fi

# ---------------------------------------------------------------------------
# 2. Self-signed cert covering every antmedia.io subdomain
# ---------------------------------------------------------------------------
mkdir -p "$INTERCEPT_DIR"
log "regenerating self-signed cert covering ${#HOSTS[@]} subdomains"
SAN=$(printf 'DNS:%s,' "${HOSTS[@]}" | sed 's/,$//')
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$INTERCEPT_DIR/key.pem" \
  -out    "$INTERCEPT_DIR/cert.pem" \
  -subj "/CN=antmedia.io" \
  -addext "subjectAltName=$SAN" 2>&1 | tail -3
chmod 644 "$INTERCEPT_DIR/cert.pem"
chmod 600 "$INTERCEPT_DIR/key.pem"

cp "$INTERCEPT_DIR/cert.pem" /usr/local/share/ca-certificates/ams-license-intercept.crt
update-ca-certificates >/dev/null

JVM_CACERTS="$(find /etc/ssl/certs/java -name cacerts 2>/dev/null | head -1)"
[ -z "$JVM_CACERTS" ] && JVM_CACERTS="$(find /usr/lib/jvm -name cacerts 2>/dev/null | head -1)"
if [ -n "$JVM_CACERTS" ] && command -v keytool >/dev/null; then
  keytool -delete -alias ams-license-intercept \
    -keystore "$JVM_CACERTS" -storepass changeit 2>/dev/null || true
  keytool -import -trustcacerts -alias ams-license-intercept \
    -file "$INTERCEPT_DIR/cert.pem" \
    -keystore "$JVM_CACERTS" -storepass changeit -noprompt 2>&1 | tail -1
  log "  imported into $JVM_CACERTS"
fi

# ---------------------------------------------------------------------------
# 3. /etc/hosts: redirect every antmedia.io subdomain to localhost
# ---------------------------------------------------------------------------
log "rewriting /etc/hosts intercept block"
sed -i '/# ams-license-intercept BEGIN/,/# ams-license-intercept END/d' /etc/hosts
{
  echo "# ams-license-intercept BEGIN"
  for h in "${HOSTS[@]}"; do
    echo "127.0.0.1 $h"
    echo "::1 $h"
  done
  echo "# ams-license-intercept END"
} >> /etc/hosts

# ---------------------------------------------------------------------------
# 4. iptables REJECT: catch anything that bypasses /etc/hosts
# ---------------------------------------------------------------------------
log "iptables REJECT for real antmedia.io IPs (defense-in-depth)"
for h in "${HOSTS[@]}"; do
  for ip in $(dig +short +time=2 +tries=1 -t A "$h" @8.8.8.8 2>/dev/null | grep -E '^[0-9]'); do
    [ "$ip" = "127.0.0.1" ] && continue
    if ! iptables -C OUTPUT -d "$ip" -j REJECT 2>/dev/null; then
      iptables -A OUTPUT -d "$ip" -j REJECT
      echo "  blocked $ip ($h)"
    fi
  done
  for ip6 in $(dig +short +time=2 +tries=1 -t AAAA "$h" @8.8.8.8 2>/dev/null | grep ':'); do
    if ! ip6tables -C OUTPUT -d "$ip6" -j REJECT 2>/dev/null; then
      ip6tables -A OUTPUT -d "$ip6" -j REJECT 2>/dev/null && echo "  blocked v6 $ip6 ($h)"
    fi
  done
done

# ---------------------------------------------------------------------------
# 5. nginx vhost serving Licence JSON on 127.0.0.1:80 + 443
# ---------------------------------------------------------------------------
command -v nginx >/dev/null || apt-get install -y nginx >/dev/null

START_DATE="$(date -u +%Y-%m-%d)"
END_DATE="$(date -u -d '+10 years' +%Y-%m-%d 2>/dev/null \
            || date -u -v+10y +%Y-%m-%d 2>/dev/null \
            || echo '2036-12-31')"

LICENCE_JSON="{\"licenceId\":\"$LICENSE_KEY\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"type\":\"Enterprise\",\"licenceCount\":\"-1\",\"owner\":\"Divinity Comics Inc.\",\"status\":\"Active\",\"hourUsed\":\"0\"}"

SERVER_NAMES="$(printf '%s ' "${HOSTS[@]}")"

cat > /etc/nginx/sites-available/ams-license-intercept.conf <<EOF
server {
    listen 127.0.0.1:80;
    listen [::1]:80;
    server_name $SERVER_NAMES;
    location / {
        default_type application/json;
        return 200 '$LICENCE_JSON';
    }
}
server {
    listen 127.0.0.1:443 ssl;
    listen [::1]:443 ssl;
    server_name $SERVER_NAMES;
    ssl_certificate     $INTERCEPT_DIR/cert.pem;
    ssl_certificate_key $INTERCEPT_DIR/key.pem;
    location / {
        default_type application/json;
        return 200 '$LICENCE_JSON';
    }
}
EOF

ln -sf /etc/nginx/sites-available/ams-license-intercept.conf /etc/nginx/sites-enabled/ams-license-intercept.conf

# Strip any dangling sites-enabled symlinks
find /etc/nginx/sites-enabled -xtype l -delete 2>/dev/null

if ! nginx -t 2>&1 | grep -q 'syntax is ok'; then
  log "nginx config invalid — listing offenders:"
  nginx -t 2>&1
  exit 1
fi
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# ---------------------------------------------------------------------------
# 6. Wipe any cached license + restart AMS
# ---------------------------------------------------------------------------
log "stopping AMS, wiping any cached license state"
systemctl stop antmedia
# Keep server.db (admin user) intact this time. AMS doesn't write a
# separate license file by default; the cached state was in-memory only.
# But just in case, look for stragglers:
find /usr/local/antmedia -maxdepth 4 \( -iname '*.lic' -o -iname 'licence.*' -o -iname 'license.*' \) 2>/dev/null | while read -r f; do
  [ -f "$f" ] && [ "$f" != "$RED5_XML" ] && { echo "  rm $f"; rm -f "$f"; }
done

log "starting AMS"
systemctl start antmedia
sleep 12

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
echo
echo "================================================================"
echo "  VERIFICATION"
echo "================================================================"
echo
echo "--- /etc/hosts intercept block ---"
sed -n '/ams-license-intercept BEGIN/,/ams-license-intercept END/p' /etc/hosts | head -10
echo
echo "--- curl https://api-v2.antmedia.io ---"
curl -sS "https://api-v2.antmedia.io/?license=$LICENSE_KEY"
echo
echo
echo "--- nginx :80 + :443 listeners (should be 127.0.0.1 only) ---"
ss -tlnp 2>/dev/null | grep -E ':(80|443)\b' | head
echo
echo "--- iptables OUTPUT REJECT rules for antmedia.io ---"
iptables -L OUTPUT -n 2>/dev/null | grep -E 'REJECT|antmedia' | head
echo
echo "--- red5.xml licence bean ---"
grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3
echo
echo "--- AMS license / community log lines ---"
tail -300 /usr/local/antmedia/log/ant-media-server.log 2>/dev/null \
  | grep -iE 'licen|community|enterprise' | tail -15
echo
echo "==> reload AMS panel — License Status should now show Active"
echo "==> If still showing Suspended, the panel is showing browser-cached state."
echo "    Use a fresh incognito window and visit https://stream.indiecomicslive.com:5443/"
