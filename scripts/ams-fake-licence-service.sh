#!/usr/bin/env bash
# ============================================================================
# scripts/ams-fake-licence-service.sh
#
# Java surgery to make the AMS panel show "License Status: Active".
#
# The bean swap in ams-license-intercept.sh stops AMS from phoning home —
# but CommunityLicenceService.getLastLicenseStatus() returns null, which the
# admin panel renders as "Invalid License".
#
# This script compiles a minimal io.antmedia.licence.FakeLicenceService that
# returns a fully-populated valid Licence object, drops it into the AMS
# classpath, and repoints the Spring bean at it.
#
# Idempotent. Run as root.
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/ams-fake-licence-service.sh | sudo bash
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

LICENCE_KEY="AMSe18a9340eba32d94b67823048cf51a"
OWNER="Divinity Comics Inc."
START_DATE="$(date -u +%Y-%m-%d)"
END_DATE="$(date -u -d '+10 years' +%Y-%m-%d 2>/dev/null || echo '2036-12-31')"

AMS_HOME=/usr/local/antmedia
LIB_DIR="$AMS_HOME/lib"
RED5_XML="$AMS_HOME/conf/red5.xml"
WORK=/opt/ams-fake-licence
JAR_OUT="$LIB_DIR/zz-fake-licence.jar"     # zz- prefix so it sorts last and wins on classpath

log() { echo -e "\n\033[1;35m[ams-fake-licence]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Ensure javac is available
# ---------------------------------------------------------------------------
if ! command -v javac >/dev/null; then
  log "installing JDK (javac not found)"
  apt-get update -qq
  apt-get install -y -qq default-jdk-headless >/dev/null
fi

JAVAC="$(command -v javac)"
JAR="$(command -v jar)"
[ -x "$JAVAC" ] && [ -x "$JAR" ] || { echo "javac/jar still missing — bail" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 2. Verify the AMS jars we need to compile against
# ---------------------------------------------------------------------------
[ -d "$LIB_DIR" ] || { echo "no $LIB_DIR — is AMS installed?" >&2; exit 1; }
log "compiling against AMS classpath ($(ls "$LIB_DIR"/*.jar 2>/dev/null | wc -l) jars)"

# ---------------------------------------------------------------------------
# 3. Write FakeLicenceService.java
# ---------------------------------------------------------------------------
mkdir -p "$WORK/src/io/antmedia/licence"
cat > "$WORK/src/io/antmedia/licence/FakeLicenceService.java" <<JAVA
package io.antmedia.licence;

import io.antmedia.datastore.db.types.Licence;
import io.antmedia.settings.ServerSettings;

public class FakeLicenceService implements ILicenceService {

    private static final String LICENCE_KEY  = "$LICENCE_KEY";
    private static final String OWNER        = "$OWNER";
    private static final String START_DATE   = "$START_DATE";
    private static final String END_DATE     = "$END_DATE";

    private final Licence cached;

    public FakeLicenceService() {
        this.cached = build();
    }

    private Licence build() {
        Licence l = new Licence();
        l.setLicenceId(LICENCE_KEY);
        l.setStartDate(START_DATE);
        l.setEndDate(END_DATE);
        l.setType("Enterprise");
        l.setLicenceCount("-1");
        l.setOwner(OWNER);
        l.setStatus("Active");
        l.setHourUsed("0");
        return l;
    }

    @Override public void start() { }

    @Override public Licence checkLicence(String key) { return build(); }

    @Override public void setServerSettings(ServerSettings s) { }

    @Override public Licence getLastLicenseStatus() { return cached; }

    @Override public boolean isLicenceSuspended() { return false; }

    @Override public String getLicenseType() { return LICENCE_TYPE_OFFLINE; }
}
JAVA

# ---------------------------------------------------------------------------
# 4. Compile + jar
# ---------------------------------------------------------------------------
log "javac"
mkdir -p "$WORK/classes"
"$JAVAC" -cp "$LIB_DIR/*" -d "$WORK/classes" "$WORK/src/io/antmedia/licence/FakeLicenceService.java"

log "packaging $JAR_OUT"
( cd "$WORK/classes" && "$JAR" cf "$JAR_OUT" io/antmedia/licence/FakeLicenceService.class )
chmod 644 "$JAR_OUT"
echo "  jar contents:"
"$JAR" tf "$JAR_OUT"

# ---------------------------------------------------------------------------
# 5. Patch red5.xml to point bean at FakeLicenceService
# ---------------------------------------------------------------------------
log "patching $RED5_XML licence bean -> FakeLicenceService"
cp "$RED5_XML" "$RED5_XML.bak.fakelic.$(date +%s)"
python3 - <<PY
import re, pathlib
p = pathlib.Path("$RED5_XML")
s = p.read_text()
new = re.sub(
    r'(<bean[^>]*id="ant\.media\.licence\.service"[^>]*class=)"[^"]+"',
    r'\1"io.antmedia.licence.FakeLicenceService"',
    s, count=1)
new = re.sub(
    r'(<bean[^>]*class=)"[^"]+"([^>]*id="ant\.media\.licence\.service")',
    r'\1"io.antmedia.licence.FakeLicenceService"\2',
    new, count=1)
p.write_text(new)
print("patched" if s != new else "no change")
PY

echo "  current bean:"
grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3

# ---------------------------------------------------------------------------
# 6. Restart AMS
# ---------------------------------------------------------------------------
log "restarting AMS"
systemctl restart antmedia
sleep 12

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
echo
echo "================================================================"
echo "  VERIFICATION"
echo "================================================================"
echo
echo "--- jar dropped in classpath ---"
ls -la "$JAR_OUT"
echo
echo "--- red5.xml licence bean ---"
grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3
echo
echo "--- AMS startup log: should NOT show licence errors ---"
tail -300 /usr/local/antmedia/log/ant-media-server.log 2>/dev/null \
  | grep -iE 'licen|fakelicence|community|enterprise.*licen|suspend' | tail -15
echo
echo "--- internal REST: GET /rest/v2/last-licence-status ---"
curl -sS -u "mikeisflux@indiecomicslive.com:CHANGE_ME_IF_YOU_WANT_THIS_CHECK" \
  http://127.0.0.1:5080/rest/v2/last-licence-status 2>/dev/null \
  | head -c 400
echo
echo
echo "==> Reload AMS panel in INCOGNITO at https://stream.indiecomicslive.com:5443/"
echo "==> License Status should now show: Active"
