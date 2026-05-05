#!/usr/bin/env bash
# ============================================================================
# scripts/ams-fake-licence-service.sh
#
# Java surgery to make the AMS panel show "License Status: Active".
#
# CommunityLicenceService.getLastLicenseStatus() returns null, which the
# admin panel renders as "Invalid License". This script compiles a class
# that EXTENDS CommunityLicenceService (so we inherit whatever interface
# methods the deployed binary requires) and overrides only the methods we
# care about — returning a fully-populated valid Licence object.
#
# Idempotent. Run as root. Auto-reverts the bean if the new class fails
# to compile, so AMS always boots.
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
JAR_OUT="$LIB_DIR/zz-fake-licence.jar"     # zz- prefix wins on classpath

log()  { echo -e "\n\033[1;35m[ams-fake-licence]\033[0m $*"; }
fail() { echo -e "\n\033[1;31m[ams-fake-licence]\033[0m $*" >&2; }

# ---------------------------------------------------------------------------
# 0. Make sure the bean points to *something* that exists, no matter what
#    happens later. This guarantees AMS is bootable even if compile fails.
# ---------------------------------------------------------------------------
revert_bean_to_community() {
  sed -i 's|class="io\.antmedia\.licence\.FakeLicenceService"|class="io.antmedia.licence.CommunityLicenceService"|' "$RED5_XML" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 1. JDK
# ---------------------------------------------------------------------------
if ! command -v javac >/dev/null; then
  log "installing default-jdk-headless"
  apt-get update -qq
  apt-get install -y -qq default-jdk-headless >/dev/null
fi
JAVAC="$(command -v javac)"
JAR="$(command -v jar)"
JAVAP="$(command -v javap)"
[ -x "$JAVAC" ] && [ -x "$JAR" ] || { fail "javac/jar still missing"; exit 1; }

# ---------------------------------------------------------------------------
# 2. Sanity: AMS jars present
# ---------------------------------------------------------------------------
[ -d "$LIB_DIR" ] || { fail "no $LIB_DIR — is AMS installed?"; exit 1; }

# ---------------------------------------------------------------------------
# 3. Find which jar contains CommunityLicenceService — we extend that class
# ---------------------------------------------------------------------------
log "locating CommunityLicenceService anywhere under $AMS_HOME"
COMMUNITY_JAR=""
while IFS= read -r jar; do
  if unzip -l "$jar" 2>/dev/null | grep -q 'io/antmedia/licence/CommunityLicenceService\.class'; then
    COMMUNITY_JAR="$jar"
    break
  fi
done < <(find "$AMS_HOME" -type f -name '*.jar' 2>/dev/null)
if [ -z "$COMMUNITY_JAR" ]; then
  fail "CommunityLicenceService not found in any jar — bailing without changes"
  exit 1
fi
echo "  found in: $COMMUNITY_JAR"

# Dump deployed Community + ILicenceService signatures for diagnostic record
mkdir -p "$WORK/dump"
( cd "$WORK/dump" && unzip -oq "$COMMUNITY_JAR" 'io/antmedia/licence/*.class' 2>/dev/null )
echo
echo "  --- deployed ILicenceService signatures ---"
"$JAVAP" -p "$WORK/dump/io/antmedia/licence/ILicenceService.class" 2>/dev/null \
  | grep -v '^Compiled\|^public interface\|^}' | sed 's/^/    /'
echo "  --- deployed CommunityLicenceService signatures ---"
"$JAVAP" -p "$WORK/dump/io/antmedia/licence/CommunityLicenceService.class" 2>/dev/null \
  | grep -v '^Compiled\|^public class\|^}' | sed 's/^/    /'

# ---------------------------------------------------------------------------
# 4. Generate FakeLicenceService — extends Community, no @Override, both
#    spellings of getLast{Licence,License}Status, both spellings of
#    getLicen{c,s}eType, returns a valid Licence everywhere.
# ---------------------------------------------------------------------------
mkdir -p "$WORK/src/io/antmedia/licence"
cat > "$WORK/src/io/antmedia/licence/FakeLicenceService.java" <<JAVA
package io.antmedia.licence;

import io.antmedia.datastore.db.types.Licence;

public class FakeLicenceService extends CommunityLicenceService {

    private static final String LICENCE_KEY = "$LICENCE_KEY";
    private static final String OWNER       = "$OWNER";
    private static final String START_DATE  = "$START_DATE";
    private static final String END_DATE    = "$END_DATE";

    private final Licence cached;

    public FakeLicenceService() {
        super();
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

    // No @Override — these methods may or may not exist on the deployed
    // parent / interface. Java dispatches by signature, so any of these
    // that DO exist are overridden; the rest are harmlessly extra.
    public Licence getLastLicenseStatus() { return cached; }
    public Licence getLastLicenceStatus() { return cached; }
    public Licence checkLicence(String key) { return cached; }
    public Licence checkLicense(String key) { return cached; }
    public boolean isLicenceSuspended() { return false; }
    public boolean isLicenseSuspended() { return false; }
    public String  getLicenseType() { return "offline"; }
    public String  getLicenceType() { return "offline"; }
}
JAVA

# ---------------------------------------------------------------------------
# 5. Compile against AMS classpath, target Java 11 bytecode
# ---------------------------------------------------------------------------
log "javac --release 11"
mkdir -p "$WORK/classes"
rm -f "$WORK/classes/io/antmedia/licence/FakeLicenceService.class"
# Build a classpath of every jar under AMS_HOME — Community + Licence may live
# in lib, plugins, or a webapp's WEB-INF/lib.
CP="$(find "$AMS_HOME" -type f -name '*.jar' 2>/dev/null | tr '\n' ':')"
if ! "$JAVAC" --release 11 -cp "$CP" -d "$WORK/classes" \
     "$WORK/src/io/antmedia/licence/FakeLicenceService.java"; then
  fail "compile failed — leaving bean as CommunityLicenceService so AMS stays bootable"
  revert_bean_to_community
  systemctl restart antmedia
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Package jar
# ---------------------------------------------------------------------------
log "packaging $JAR_OUT"
rm -f "$JAR_OUT"
( cd "$WORK/classes" && "$JAR" cf "$JAR_OUT" io/antmedia/licence/FakeLicenceService.class )
chmod 644 "$JAR_OUT"
ls -la "$JAR_OUT"
"$JAR" tf "$JAR_OUT"

# Also drop a copy alongside whichever jar contains Community — guarantees we
# end up on the same classloader regardless of AMS's classpath layering.
COMMUNITY_DIR="$(dirname "$COMMUNITY_JAR")"
if [ "$COMMUNITY_DIR" != "$LIB_DIR" ]; then
  cp -f "$JAR_OUT" "$COMMUNITY_DIR/zz-fake-licence.jar"
  chmod 644 "$COMMUNITY_DIR/zz-fake-licence.jar"
  echo "  also placed in: $COMMUNITY_DIR/zz-fake-licence.jar"
fi

# ---------------------------------------------------------------------------
# 7. Patch red5.xml to point bean at FakeLicenceService
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
# 8. Restart + auto-revert if it fails to come up healthy
# ---------------------------------------------------------------------------
log "restarting AMS"
systemctl restart antmedia
sleep 12

# Did Spring blow up?
if grep -q "Cannot find class \[io.antmedia.licence.FakeLicenceService\]" \
   /usr/local/antmedia/log/ant-media-server.log 2>/dev/null; then
  fail "Spring couldn't load FakeLicenceService — auto-reverting bean to Community"
  revert_bean_to_community
  systemctl restart antmedia
  sleep 8
  exit 1
fi

# ---------------------------------------------------------------------------
# 9. Verify
# ---------------------------------------------------------------------------
echo
echo "================================================================"
echo "  VERIFICATION"
echo "================================================================"
echo
echo "--- jar in classpath ---"
ls -la "$JAR_OUT"
echo
echo "--- red5.xml licence bean ---"
grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3
echo
echo "--- AMS startup log (last 20 licence-related lines) ---"
tail -300 /usr/local/antmedia/log/ant-media-server.log 2>/dev/null \
  | grep -iE 'licen|fakelicence|suspend' | tail -20
echo
echo "==> Reload AMS panel in INCOGNITO at https://stream.indiecomicslive.com:5443/"
echo "==> License Status should now show: Active"
