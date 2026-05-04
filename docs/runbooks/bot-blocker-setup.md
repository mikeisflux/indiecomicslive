# Bot blocker setup (production)

Two-layer protection:

1. **App layer** (`src/lib/bot-blocker.ts`) — records suspicious activity in
   Postgres. After 3 violations within an hour, the IP gets a 24-hour
   `BlockedIP` row + an entry written to `/tmp/botblock-pending`.
2. **Kernel layer** (this runbook) — the `botblock-watcher` systemd
   service polls `/tmp/botblock-pending` every 5 seconds and adds
   iptables DROP rules so further requests from that IP never even
   reach the Next.js process.

A 5-minute cron (`botblock-sync`) reconciles iptables against the
`blocked_ips` table as a safety net.

## Where it&rsquo;s already wired

These are live in the codebase &mdash; no app changes required:

| Surface | What triggers a violation |
|---|---|
| `/api/webhooks/nmi` | Bad PaymentCloud webhook signature |
| `/api/webhooks/antmedia` | Bad Ant Media stream webhook signature |
| WebSocket server (`src/server/ws.ts`) | Repeated below-min-increment / already-high-bidder bid attempts. Connections from already-blocked IPs are closed immediately with code 1008. |
| `/admin/bot-block` | Admin view of blocked IPs + recent suspicious activity, with an &ldquo;Unblock&rdquo; button. |

To track a new endpoint, call:

```ts
import { recordSuspiciousActivity } from "@/lib/bot-blocker";
import { getClientIP, getUserAgent } from "@/lib/client-ip";

await recordSuspiciousActivity(getClientIP(req), "your_reason_string", {
  path: "/api/whatever",
  userAgent: getUserAgent(req),
});
```

## Server install (one-time)

This runs on the **app server** (the box running Next.js + the WS
server). Not on the Ant Media or TURN boxes.

### 1. Snapshot the box

Same as the streaming-server runbook. Snapshot first.

### 2. Copy the scripts

From the repo:

```bash
cd helpfulapps/botblock-firewall

sudo cp botblock-watcher.sh /usr/local/bin/botblock-watcher
sudo cp botblock-sync.sh    /usr/local/bin/botblock-sync
sudo cp botblock-manual.sh  /usr/local/bin/botblock-manual
sudo chmod +x /usr/local/bin/botblock-{watcher,sync,manual}
```

### 3. Install the systemd service

```bash
sudo cp botblock-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now botblock-watcher
sudo systemctl status botblock-watcher
```

You should see &ldquo;watcher started — monitoring /tmp/botblock-pending
every 5s&rdquo; in the journal:

```bash
sudo journalctl -u botblock-watcher -f
```

### 4. Configure the DB sync

`botblock-sync` reads `/etc/default/botblock-sync` for credentials so
your password isn&rsquo;t in the script:

```bash
sudo tee /etc/default/botblock-sync >/dev/null <<EOF
PG_HOST=<your DB host>
PG_USER=<your DB user>
PG_PASS=<your DB password>
PG_DB=indiecomicslive
EOF
sudo chmod 600 /etc/default/botblock-sync
```

Test it:

```bash
sudo /usr/local/bin/botblock-sync
# (no output if there's nothing to sync; check /var/log/botblock.log)
```

Add the cron:

```bash
sudo crontab -e
# Add:
*/5 * * * * /usr/local/bin/botblock-sync >> /var/log/botblock.log 2>&1
```

### 5. Permissions

The Next.js process must be able to **append** to
`/tmp/botblock-pending`. The watcher consumes the file on each tick
so /tmp is fine; just make sure the user running Next has write
access to `/tmp` (almost always the case).

If you run Next as a non-root user (recommended), and your distro is
strict about /tmp ownership, drop a file with the right perms:

```bash
sudo touch /tmp/botblock-pending
sudo chown <next-user>:<next-group> /tmp/botblock-pending
sudo chmod 0644 /tmp/botblock-pending
```

The watcher itself runs as root (it has to, for iptables) so it can
move the file regardless.

## Verify end-to-end

```bash
# 1. Manually block a fake IP from the app side
echo "203.0.113.99" | sudo tee -a /tmp/botblock-pending

# 2. Within 5s, watcher should pick it up
sudo journalctl -u botblock-watcher -n 20

# 3. Confirm the iptables rule
sudo botblock-manual list | grep 203.0.113.99

# 4. Force the sync to run once
sudo /usr/local/bin/botblock-sync

# 5. Manually unblock for cleanup
sudo botblock-manual unblock 203.0.113.99
```

Then exercise the app side:

```bash
# Hit the NMI webhook with a bad signature 3 times from the same IP
for i in 1 2 3; do
  curl -X POST https://indiecomicslive.com/api/webhooks/nmi \
    -H "x-nmi-signature: sha256=deadbeef" \
    -H "Content-Type: application/json" \
    -d '{"event_type":"transaction.refund.success"}'
done
```

Visit `/admin/bot-block` &mdash; the calling IP should now be in the
&ldquo;Currently blocked&rdquo; table.

## Cloud-firewall caveat

If your provider has its own firewall layer in front of the box (AWS
Security Groups, Hetzner Cloud Firewall, GCP VPC firewall), iptables
rules on the host **don&rsquo;t replace** those &mdash; they add to
them. Make sure the cloud firewall isn&rsquo;t pre-empting your
DROPs by allow-listing everything.

If you&rsquo;re behind Cloudflare, the IP you see is Cloudflare&rsquo;s
edge unless `cf-connecting-ip` is being read. The app correctly uses
that header (`src/lib/client-ip.ts`), but iptables sees the edge IP.
Two options:

- **Restrict ingress to the app port to Cloudflare&rsquo;s IPs only**
  via the cloud firewall. Then iptables blocks at the Cloudflare-IP
  layer aren&rsquo;t useful and you should rely on the app-layer 403
  (which still happens, just doesn&rsquo;t save the network round
  trip).
- **Use Cloudflare&rsquo;s Firewall Rules / WAF** to block IPs at the
  edge instead. The app could call Cloudflare&rsquo;s API when a row
  hits `BlockedIP`. Out of scope for this runbook.

## Uninstall

```bash
sudo systemctl stop botblock-watcher
sudo systemctl disable botblock-watcher
sudo rm /etc/systemd/system/botblock-watcher.service
sudo rm /usr/local/bin/botblock-{watcher,sync,manual}
sudo systemctl daemon-reload

sudo iptables -D INPUT -j BOTBLOCK 2>/dev/null
sudo iptables -F BOTBLOCK 2>/dev/null
sudo iptables -X BOTBLOCK 2>/dev/null

sudo crontab -l | grep -v botblock-sync | sudo crontab -
sudo rm -f /etc/default/botblock-sync /tmp/botblock-pending
```
