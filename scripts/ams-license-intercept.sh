#!/usr/bin/env bash
# ============================================================================
# scripts/ams-license-intercept.sh
#
# Stops Ant Media Server from contacting antmedia.io to validate its
# license. Adds /etc/hosts redirect + a local HTTPS endpoint (via nginx)
# that responds to AMS's license check with {"valid":true,...}, plus
# imports a self-signed cert for api-v2.antmedia.io into the JVM
# truststore so AMS trusts the local intercept.
#
# Run on the media box.
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/ams-license-intercept.sh | sudo bash
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

INTERCEPT_DIR=/opt/ams-license-intercept
HOSTS=(api-v2.antmedia.io api.antmedia.io license.antmedia.io)

log() { echo -e "\n\033[1;35m[ams-license]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Self-signed cert for the AMS license hosts
# ---------------------------------------------------------------------------
mkdir -p "$INTERCEPT_DIR"
if [ ! -f "$INTERCEPT_DIR/cert.pem" ]; then
  log "generating self-signed cert for: ${HOSTS[*]}"
  SAN=$(printf 'DNS:%s,' "${HOSTS[@]}" | sed 's/,$//')
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$INTERCEPT_DIR/key.pem" \
    -out    "$INTERCEPT_DIR/cert.pem" \
    -subj "/CN=api-v2.antmedia.io" \
    -addext "subjectAltName=$SAN"
fi
chmod 644 "$INTERCEPT_DIR/cert.pem"
chmod 600 "$INTERCEPT_DIR/key.pem"

# ---------------------------------------------------------------------------
# 2. Trust the cert in the system + JVM
# ---------------------------------------------------------------------------
log "installing cert into system trust store"
cp "$INTERCEPT_DIR/cert.pem" /usr/local/share/ca-certificates/ams-license-intercept.crt
update-ca-certificates >/dev/null

log "installing cert into JVM truststore"
JVM_CACERTS="$(find /etc/ssl/certs/java -name cacerts 2>/dev/null | head -1)"
if [ -z "$JVM_CACERTS" ]; then
  # Fall back to the JRE bundled cacerts under JAVA_HOME
  JVM_CACERTS="$(find /usr/lib/jvm -name cacerts 2>/dev/null | head -1)"
fi
if [ -n "$JVM_CACERTS" ] && command -v keytool >/dev/null; then
  keytool -delete -alias ams-license-intercept \
    -keystore "$JVM_CACERTS" -storepass changeit 2>/dev/null || true
  keytool -import -trustcacerts -alias ams-license-intercept \
    -file "$INTERCEPT_DIR/cert.pem" \
    -keystore "$JVM_CACERTS" -storepass changeit -noprompt
  log "imported into $JVM_CACERTS"
else
  log "WARNING: could not find JVM cacerts. AMS may not trust the cert."
fi

# ---------------------------------------------------------------------------
# 3. /etc/hosts redirect
# ---------------------------------------------------------------------------
log "adding /etc/hosts entries"
# Strip any prior intercept block
sed -i '/# ams-license-intercept BEGIN/,/# ams-license-intercept END/d' /etc/hosts
{
  echo "# ams-license-intercept BEGIN"
  for h in "${HOSTS[@]}"; do
    echo "127.0.0.1 $h"
  done
  echo "# ams-license-intercept END"
} >> /etc/hosts

# ---------------------------------------------------------------------------
# 4. nginx vhost serving the fake license response
# ---------------------------------------------------------------------------
command -v nginx >/dev/null || { log "installing nginx"; apt-get install -y nginx; }

SITE=/etc/nginx/sites-available/ams-license-intercept.conf
log "writing $SITE"

# Build the listen block — bind to 127.0.0.1 only so it doesn't conflict
# with any public nginx vhost on this box, AND any of the AMS license
# hosts will hit this because /etc/hosts points them at 127.0.0.1.
# Build the JSON response to exactly match AMS's Licence.java POJO
# (io.antmedia.datastore.db.types.Licence). All fields are String.
# Note British spelling: licenceId, licenceCount.
# endDate is 10 years out so AMS sees a valid, long-lived license.
START_DATE="$(date -u +%Y-%m-%d)"
END_DATE="$(date -u -d '+10 years' +%Y-%m-%d 2>/dev/null \
            || date -u -v+10y +%Y-%m-%d 2>/dev/null \
            || echo '2036-12-31')"

cat > "$SITE" <<EOF
server {
    listen 127.0.0.1:443 ssl;
    server_name $(printf '%s ' "${HOSTS[@]}");

    ssl_certificate     $INTERCEPT_DIR/cert.pem;
    ssl_certificate_key $INTERCEPT_DIR/key.pem;

    # Mirrors io.antmedia.datastore.db.types.Licence exactly.
    # Status=Active + endDate 10 years out = AMS treats it as valid.
    location / {
        default_type application/json;
        return 200 '{"licenceId":"indiecomicslive","startDate":"$START_DATE","endDate":"$END_DATE","type":"Enterprise","licenceCount":"-1","owner":"Divinity Comics Inc.","status":"Active","hourUsed":"0"}';
    }
}
EOF

ln -sf "$SITE" /etc/nginx/sites-enabled/ams-license-intercept.conf
nginx -t
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# ---------------------------------------------------------------------------
# 5. Restart AMS so it picks up the new truststore + new license response
# ---------------------------------------------------------------------------
log "restarting Ant Media Server"
systemctl restart antmedia
sleep 8

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
log "verifying intercept"
echo "  /etc/hosts:"
grep -A1 'ams-license-intercept BEGIN' /etc/hosts | head -5
echo
echo "  curl from this box (should return our JSON):"
curl -sS https://api-v2.antmedia.io/?license=test 2>&1 | head -3
echo
echo "  nginx vhosts on :443:"
ss -tlnp 2>/dev/null | grep ':443'
echo
log "done."
echo
echo "==> reload the AMS panel: https://stream.indiecomicslive.com:5443/"
echo "==> Settings → License Status should now show Active."
echo
echo "==> If it still shows Suspended, AMS may have cached the previous"
echo "    response. Restart the application from the panel:"
echo "       Applications → WebRTCAppEE → Restart"
