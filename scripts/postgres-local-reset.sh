#!/usr/bin/env bash
# ============================================================================
# scripts/postgres-local-reset.sh
#
# Destructive reset of a previous Postgres install on this box (Streamlick
# leftover), then re-runs postgres-local-setup.sh to install PG17 fresh.
#
# WIPES: /var/lib/postgresql, /etc/postgresql, the postgres user's data,
# every postgresql-* / pgdg-* apt package, the PGDG GPG key.
#
# Run as root.
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

log() { echo -e "\n\033[1;35m[postgres-reset]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Stop everything postgres
# ---------------------------------------------------------------------------
log "stopping any postgres services"
systemctl stop 'postgresql*' 2>/dev/null || true
systemctl disable 'postgresql*' 2>/dev/null || true
pkill -9 -u postgres 2>/dev/null || true
sleep 2

# ---------------------------------------------------------------------------
# 2. Purge every postgres-* package
# ---------------------------------------------------------------------------
log "purging postgres packages"
PKGS="$(dpkg -l 2>/dev/null | awk '/^ii/ && ($2 ~ /^postgresql/ || $2 ~ /^pgdg/) { print $2 }' | tr '\n' ' ')"
if [ -n "$PKGS" ]; then
  echo "  purging: $PKGS"
  DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq $PKGS >/dev/null
  apt-get autoremove -y -qq >/dev/null
fi

# ---------------------------------------------------------------------------
# 3. Wipe data + config
# ---------------------------------------------------------------------------
log "wiping data and config dirs"
rm -rf /var/lib/postgresql /etc/postgresql /etc/postgresql-common /var/log/postgresql
rm -rf /run/postgresql

# Remove the postgres unix user if it lingers
if id postgres >/dev/null 2>&1; then
  pkill -9 -u postgres 2>/dev/null || true
  userdel -rf postgres 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# 4. Remove the old PGDG repo + key (so postgres-local-setup re-creates them)
# ---------------------------------------------------------------------------
log "removing old PGDG repo + key"
rm -f /etc/apt/sources.list.d/pgdg.list
rm -f /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
rm -f /usr/share/keyrings/postgresql-keyring.gpg 2>/dev/null
apt-get update -qq

# ---------------------------------------------------------------------------
# 5. Wipe the saved app password so a fresh one is generated
# ---------------------------------------------------------------------------
rm -f /root/icl-secrets/postgres-app-password

# ---------------------------------------------------------------------------
# 6. Re-run the local setup script
# ---------------------------------------------------------------------------
log "running postgres-local-setup.sh"
curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/postgres-local-setup.sh \
  | bash
