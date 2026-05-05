#!/bin/bash
# ============================================================================
# botblock-sync.sh
#
# Reconciles iptables BOTBLOCK chain with the indiecomicslive `blocked_ips`
# Postgres table every 5 minutes. The watcher handles new blocks; this
# script adds anything missed and removes anything expired.
#
# Cron entry:
#   */5 * * * * /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1
#
# Reads DB config from environment or /etc/default/botblock-sync, e.g.:
#   PG_HOST=localhost
#   PG_USER=indiecomicslive
#   PG_PASS=...
#   PG_DB=indiecomicslive
# ============================================================================

set -euo pipefail

CHAIN="BOTBLOCK"
LOG_PREFIX="[BotBlock-Sync]"

# Source env file if present
if [ -f /etc/default/botblock-sync ]; then
  # shellcheck disable=SC1091
  . /etc/default/botblock-sync
fi

PG_HOST="${PG_HOST:-localhost}"
PG_USER="${PG_USER:-indiecomicslive}"
PG_PASS="${PG_PASS:-}"
PG_DB="${PG_DB:-indiecomicslive}"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX must run as root" >&2
  exit 1
fi

if [ -z "$PG_PASS" ]; then
  log "PG_PASS not set; create /etc/default/botblock-sync"
  exit 1
fi

# Ensure chain + INPUT hook
if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  iptables -N "$CHAIN"
fi
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  iptables -I INPUT -j "$CHAIN"
fi

# Active rows from the BlockedIP table
DB_IPS=$(PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -t -A -c \
  'SELECT ip_address FROM blocked_ips WHERE expires_at > NOW();' 2>/dev/null) || {
  log "failed to query database"
  exit 1
}

declare -A DB_IP_SET
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DB_IP_SET["$ip"]=1
  fi
done <<< "$DB_IPS"

declare -A FW_IP_SET
while IFS= read -r line; do
  ip=$(echo "$line" | grep -oP '(?<=-s )[0-9.]+(?=/32)' 2>/dev/null) || continue
  [ -z "$ip" ] && continue
  FW_IP_SET["$ip"]=1
done < <(iptables -S "$CHAIN" 2>/dev/null)

added=0
for ip in "${!DB_IP_SET[@]}"; do
  if [ -z "${FW_IP_SET[$ip]+x}" ]; then
    iptables -A "$CHAIN" -s "$ip/32" -j DROP
    log "ADDED $ip"
    added=$((added+1))
  fi
done

removed=0
for ip in "${!FW_IP_SET[@]}"; do
  if [ -z "${DB_IP_SET[$ip]+x}" ]; then
    iptables -D "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null || true
    log "REMOVED $ip"
    removed=$((removed+1))
  fi
done

# Garbage-collect rows that have been expired for > 7 days. The app
# already cleans these up hourly, but a fallback never hurts.
PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
  "DELETE FROM blocked_ips WHERE expires_at < NOW() - INTERVAL '7 days';" >/dev/null 2>&1 || true

total=${#DB_IP_SET[@]}
if [ "$added" -gt 0 ] || [ "$removed" -gt 0 ]; then
  log "sync: $total active, +$added -$removed"
fi
