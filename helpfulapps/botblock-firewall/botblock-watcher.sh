#!/bin/bash
# ============================================================================
# botblock-watcher.sh
#
# Watches /tmp/botblock-pending for newly blocked IPs and immediately adds
# iptables DROP rules so the kernel drops packets before they reach the
# Next.js process. Checks every 5 seconds.
#
# The Next.js app (src/lib/bot-blocker.ts) writes IPs to /tmp/botblock-pending
# whenever an IP exceeds the suspicious-activity threshold. This script
# turns those entries into kernel firewall drops.
#
# Install:
#   sudo cp botblock-watcher.sh /usr/local/bin/botblock-watcher
#   sudo chmod +x /usr/local/bin/botblock-watcher
#   sudo cp botblock-watcher.service /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now botblock-watcher
# ============================================================================

set -uo pipefail

CHAIN="BOTBLOCK"
CHAIN6="BOTBLOCK6"
PENDING_FILE="/tmp/botblock-pending"
INTERVAL=5
LOG_PREFIX="[BotBlock]"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX must run as root" >&2
  exit 1
fi

# IPv4 chain
if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  log "creating iptables chain: $CHAIN"
  iptables -N "$CHAIN"
fi
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  log "hooking $CHAIN into INPUT"
  iptables -I INPUT -j "$CHAIN"
fi

# IPv6 chain (best-effort — skip silently if ip6tables isn't available)
if command -v ip6tables >/dev/null 2>&1; then
  if ! ip6tables -n -L "$CHAIN6" >/dev/null 2>&1; then
    log "creating ip6tables chain: $CHAIN6"
    ip6tables -N "$CHAIN6"
  fi
  if ! ip6tables -C INPUT -j "$CHAIN6" 2>/dev/null; then
    log "hooking $CHAIN6 into INPUT (v6)"
    ip6tables -I INPUT -j "$CHAIN6"
  fi
fi

log "watcher started — monitoring $PENDING_FILE every ${INTERVAL}s"

while true; do
  if [ -s "$PENDING_FILE" ]; then
    WORK_FILE="/tmp/botblock-processing.$$"
    mv "$PENDING_FILE" "$WORK_FILE" 2>/dev/null || { sleep "$INTERVAL"; continue; }

    sort -u "$WORK_FILE" | while IFS= read -r ip; do
      [ -z "$ip" ] && continue

      if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        if ! iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
          iptables -A "$CHAIN" -s "$ip/32" -j DROP
          log "BLOCKED v4 $ip"
        fi
      elif [[ "$ip" =~ : ]]; then
        # IPv6 — accepted forms vary; let ip6tables validate
        if command -v ip6tables >/dev/null 2>&1; then
          if ! ip6tables -C "$CHAIN6" -s "$ip" -j DROP 2>/dev/null; then
            if ip6tables -A "$CHAIN6" -s "$ip" -j DROP 2>/dev/null; then
              log "BLOCKED v6 $ip"
            else
              log "SKIP invalid v6: $ip"
            fi
          fi
        fi
      else
        log "SKIP invalid: $ip"
      fi
    done

    rm -f "$WORK_FILE"
  fi

  sleep "$INTERVAL"
done
