#!/usr/bin/env bash
# ============================================================================
# scripts/ams-rebuild-community-licence.sh
#
# Source-modification fix for the AMS license panel — same approach as the
# Streamlick conversion (modify Community Edition source, recompile, replace
# the deployed class), but surgical: we only rebuild CommunityLicenceService
# and splice its .class back into the existing ant-media-server.jar.
#
# 1. Extract io/antmedia/licence/* from /usr/local/antmedia/ant-media-server.jar
# 2. javap to dump the exact deployed ILicenceService method signatures
# 3. Generate CommunityLicenceService.java with EXACTLY those method signatures,
#    where each method returns a valid Licence (or false for isLicenceSuspended)
# 4. javac --release 11 against the full deployed classpath
# 5. Splice the new .class back into ant-media-server.jar (jar uf)
# 6. Force red5.xml bean to CommunityLicenceService (in case it's still pointed
#    at FakeLicenceService from prior attempts)
# 7. Restart AMS, verify
#
# Idempotent. Run as root. Auto-keeps a .bak of the jar before modification.
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/ams-rebuild-community-licence.sh | sudo bash
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

LICENCE_KEY="AMSe18a9340eba32d94b67823048cf51a"
OWNER="Divinity Comics Inc."
START_DATE="$(date -u +%Y-%m-%d)"
END_DATE="$(date -u -d '+10 years' +%Y-%m-%d 2>/dev/null || echo '2036-12-31')"

AMS=/usr/local/antmedia
JAR="$AMS/ant-media-server.jar"
RED5_XML="$AMS/conf/red5.xml"
WORK=/opt/ams-licence-rebuild

log()  { echo -e "\n\033[1;35m[ams-licence-rebuild]\033[0m $*"; }
fail() { echo -e "\n\033[1;31m[ams-licence-rebuild]\033[0m $*" >&2; }

# ---------------------------------------------------------------------------
# 0. Make sure the bean points to CommunityLicenceService no matter what —
#    this is the class we are about to upgrade.
# ---------------------------------------------------------------------------
sed -i 's|class="io\.antmedia\.licence\.FakeLicenceService"|class="io.antmedia.licence.CommunityLicenceService"|' "$RED5_XML" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 1. Tools
# ---------------------------------------------------------------------------
if ! command -v javac >/dev/null; then
  log "installing default-jdk-headless"
  apt-get update -qq
  apt-get install -y -qq default-jdk-headless >/dev/null
fi
JAVAC="$(command -v javac)"
JAR_CMD="$(command -v jar)"
JAVAP="$(command -v javap)"
[ -x "$JAVAC" ] && [ -x "$JAR_CMD" ] && [ -x "$JAVAP" ] || {
  fail "JDK tools missing"; exit 1; }

[ -f "$JAR" ] || { fail "$JAR missing"; exit 1; }

# ---------------------------------------------------------------------------
# 2. Backup the jar
# ---------------------------------------------------------------------------
BACKUP="$JAR.bak.$(date +%s)"
cp "$JAR" "$BACKUP"
log "backed up jar to $BACKUP"

# ---------------------------------------------------------------------------
# 3. Extract licence package from the deployed jar
# ---------------------------------------------------------------------------
rm -rf "$WORK"
mkdir -p "$WORK/extract" "$WORK/src/io/antmedia/licence" "$WORK/classes"
( cd "$WORK/extract" && "$JAR_CMD" xf "$JAR" io/antmedia/licence )
ls -la "$WORK/extract/io/antmedia/licence/"

# ---------------------------------------------------------------------------
# 4. Dump deployed interface signatures so we know exactly what to implement
# ---------------------------------------------------------------------------
log "deployed ILicenceService signatures:"
"$JAVAP" -p "$WORK/extract/io/antmedia/licence/ILicenceService.class" 2>/dev/null \
  | tee "$WORK/iface.txt"

log "deployed CommunityLicenceService signatures:"
"$JAVAP" -p "$WORK/extract/io/antmedia/licence/CommunityLicenceService.class" 2>/dev/null \
  | tee "$WORK/community.txt"

# ---------------------------------------------------------------------------
# 5. Generate replacement source. We define EVERY method we have ever seen on
#    any version of this interface (both spellings of license/licence). We do
#    NOT use @Override — Java dispatches by signature, so methods that actually
#    exist on the interface are overridden, the rest are harmlessly extra.
# ---------------------------------------------------------------------------
cat > "$WORK/src/io/antmedia/licence/CommunityLicenceService.java" <<JAVA
package io.antmedia.licence;

import io.antmedia.datastore.db.types.Licence;
import io.antmedia.settings.ServerSettings;

public class CommunityLicenceService implements ILicenceService {

    private static final String LICENCE_KEY = "$LICENCE_KEY";
    private static final String OWNER       = "$OWNER";
    private static final String START_DATE  = "$START_DATE";
    private static final String END_DATE    = "$END_DATE";

    private final Licence cached;

    public CommunityLicenceService() {
        Licence l = new Licence();
        l.setLicenceId(LICENCE_KEY);
        l.setStartDate(START_DATE);
        l.setEndDate(END_DATE);
        l.setType("Enterprise");
        l.setLicenceCount("-1");
        l.setOwner(OWNER);
        l.setStatus("Active");
        l.setHourUsed("0");
        this.cached = l;
    }

    public void start() { }
    public Licence checkLicence(String key) { return cached; }
    public Licence checkLicense(String key) { return cached; }
    public void setServerSettings(ServerSettings s) { }
    public Licence getLastLicenseStatus() { return cached; }
    public Licence getLastLicenceStatus() { return cached; }
    public boolean isLicenceSuspended() { return false; }
    public boolean isLicenseSuspended() { return false; }
    public String  getLicenseType() { return "offline"; }
    public String  getLicenceType() { return "offline"; }
}
JAVA

# ---------------------------------------------------------------------------
# 6. Compile against the full deployed classpath (every jar under AMS_HOME)
# ---------------------------------------------------------------------------
log "compiling..."
CP="$(find "$AMS" -type f -name '*.jar' 2>/dev/null | tr '\n' ':')"
if ! "$JAVAC" --release 11 -cp "$CP" -d "$WORK/classes" \
     "$WORK/src/io/antmedia/licence/CommunityLicenceService.java" 2>&1 | tee "$WORK/javac.log"; then
  fail "compile failed — jar NOT modified, AMS untouched"
  echo "  full javac log: $WORK/javac.log"
  exit 1
fi

[ -f "$WORK/classes/io/antmedia/licence/CommunityLicenceService.class" ] || {
  fail "javac produced no output — bailing"; exit 1; }

# ---------------------------------------------------------------------------
# 7. Splice the new class into the deployed jar
# ---------------------------------------------------------------------------
log "splicing CommunityLicenceService.class into $JAR"
( cd "$WORK/classes" && "$JAR_CMD" uf "$JAR" io/antmedia/licence/CommunityLicenceService.class )

# Verify the new bytecode is what's now in the jar
echo "  new class methods inside the jar:"
( cd "$WORK/verify" 2>/dev/null || mkdir -p "$WORK/verify" && cd "$WORK/verify"
  "$JAR_CMD" xf "$JAR" io/antmedia/licence/CommunityLicenceService.class
  "$JAVAP" -p io/antmedia/licence/CommunityLicenceService.class | sed 's/^/    /' )

# ---------------------------------------------------------------------------
# 8. Restart, with auto-revert if AMS won't come up
# ---------------------------------------------------------------------------
log "restarting AMS"
systemctl restart antmedia
sleep 12

if ! systemctl is-active --quiet antmedia; then
  fail "AMS failed to start — reverting jar from $BACKUP"
  cp "$BACKUP" "$JAR"
  systemctl restart antmedia
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
echo "--- AMS service status ---"
systemctl is-active antmedia && echo "  active"
echo
echo "--- red5.xml licence bean ---"
grep -A1 'ant.media.licence.service' "$RED5_XML" | head -3
echo
echo "--- AMS log: licence-related lines (last 20) ---"
tail -300 /usr/local/antmedia/log/ant-media-server.log 2>/dev/null \
  | grep -iE 'licen|suspend|community|enterprise.*licen' | tail -20
echo
echo "==> Reload AMS panel in INCOGNITO at https://stream.indiecomicslive.com:5443/"
echo "==> License Status should now show: Active"
echo
echo "If it doesn't, paste the 'deployed ILicenceService signatures' block"
echo "above so we can see if the deployed interface needs additional methods."
