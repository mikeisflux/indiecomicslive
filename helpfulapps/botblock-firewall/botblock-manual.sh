#!/bin/bash
# ============================================================================
# botblock-manual.sh — manage BOTBLOCK iptables chain from the CLI
#
# Usage:
#   sudo botblock-manual block 1.2.3.4
#   sudo botblock-manual unblock 1.2.3.4
#   sudo botblock-manual list
#   sudo botblock-manual flush
#   sudo botblock-manual count
# ============================================================================

set -uo pipefail

CHAIN="BOTBLOCK"

if [ "$(id -u)" -ne 0 ]; then
  echo "must run as root" >&2
  exit 1
fi

usage() {
  echo "Usage: $0 {block|unblock|list|flush|count} [IP]"
  exit 1
}

ensure_chain() {
  if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
    iptables -N "$CHAIN"
    iptables -I INPUT -j "$CHAIN"
  fi
}

case "${1:-}" in
  block)
    ip="${2:-}"
    [ -z "$ip" ] && { echo "IP required"; exit 1; }
    [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && { echo "bad IP"; exit 1; }
    ensure_chain
    if iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
      echo "$ip already blocked"
    else
      iptables -A "$CHAIN" -s "$ip/32" -j DROP
      echo "blocked $ip"
    fi
    echo "$ip" >> /tmp/botblock-pending 2>/dev/null || true
    ;;

  unblock)
    ip="${2:-}"
    [ -z "$ip" ] && { echo "IP required"; exit 1; }
    ensure_chain
    if iptables -D "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
      echo "unblocked $ip"
    else
      echo "$ip was not blocked"
    fi
    ;;

  list)
    ensure_chain
    iptables -S "$CHAIN" 2>/dev/null | grep -oP '(?<=-s )[0-9.]+(?=/32)' | sort || echo "(none)"
    ;;

  flush)
    ensure_chain
    iptables -F "$CHAIN"
    echo "flushed $CHAIN"
    ;;

  count)
    ensure_chain
    iptables -S "$CHAIN" 2>/dev/null | grep -c '\-s' || echo 0
    ;;

  *)
    usage
    ;;
esac
