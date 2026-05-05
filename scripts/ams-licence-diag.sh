#!/usr/bin/env bash
# Diagnostic: list every licence-related class in every AMS jar/war.
set -uo pipefail
AMS_HOME=/usr/local/antmedia

echo "=== bean class currently in red5.xml ==="
grep -A1 'ant.media.licence.service' "$AMS_HOME/conf/red5.xml" | head -3

echo
echo "=== AMS JREs / Java versions on disk ==="
find "$AMS_HOME" -name 'java' -type f 2>/dev/null
which java javac

echo
echo "=== every jar/war under $AMS_HOME ==="
find "$AMS_HOME" -type f \( -name '*.jar' -o -name '*.war' \) | sort

echo
echo "=== licence-related classes by jar/war ==="
while IFS= read -r f; do
  hits=$(unzip -l "$f" 2>/dev/null | grep -iE 'licen|/licence/' || true)
  if [ -n "$hits" ]; then
    echo "--- $f ---"
    echo "$hits" | head -30
    echo
  fi
done < <(find "$AMS_HOME" -type f \( -name '*.jar' -o -name '*.war' \))

echo
echo "=== WEB-INF/lib jars under each webapp ==="
find "$AMS_HOME/webapps" -path '*/WEB-INF/lib' -type d 2>/dev/null | while read d; do
  echo "--- $d ---"
  ls "$d" | head -20
done
