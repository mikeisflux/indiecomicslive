# App server deploy

Wipe the streamlick app box, install Node + nginx + bot-blocker, deploy
the indiecomicslive Next.js app + WS server, swap DNS. Each phase is
reversible up until the &ldquo;delete streamlick&rdquo; step.

## Prerequisites

Have ready:

- Root SSH to the app box.
- `DATABASE_URL` from your Postgres (Neon / Supabase / RDS / self-hosted).
- 32-byte secrets:
  ```bash
  openssl rand -base64 32   # AUTH_SECRET
  openssl rand -base64 32   # BANK_ACCOUNT_ENCRYPTION_KEY
  openssl rand -base64 48   # ANT_MEDIA_JWT_SECRET (use the same on the streaming box)
  openssl rand -base64 48   # ANT_MEDIA_WEBHOOK_SECRET (same)
  openssl rand -base64 48   # NMI_WEBHOOK_SECRET
  openssl rand -base64 48   # TURN_SHARED_SECRET (same as coturn static-auth-secret)
  ```
- `NMI_SECURITY_KEY` and `NMI_PUBLIC_KEY` from the PaymentCloud merchant portal.
- R2 access key + secret + bucket name + public URL.
- Resend API key + verified `noreply@indiecomicslive.com` sender.
- DNS access for `indiecomicslive.com` and `www.indiecomicslive.com`.

## Phase 0 — snapshot

Before touching the existing streamlick box:

```bash
# Hetzner
hcloud server create-image --type snapshot --description "pre-icl-deploy $(date -u +%FT%TZ)" <name>

# DigitalOcean
doctl compute droplet-action snapshot <id> --snapshot-name "pre-icl-deploy"
```

Confirm in the provider console.

## Phase 1 — wipe streamlick (reversible until you nuke disks)

```bash
ssh root@<old-app-box>

# Stop the streamlick services. Don't `disable` yet — that would
# erase install state we may need to consult.
systemctl stop streamlick.service streamlick-worker.service 2>/dev/null
systemctl stop nginx 2>/dev/null

# Take note of what's running before you start removing
systemctl list-unit-files --state=enabled | tee /root/pre-wipe-units.txt
ls -la /opt /var/www /srv /etc/nginx/sites-enabled | tee -a /root/pre-wipe-units.txt
```

If the box was running nginx/postgres/redis exclusively for streamlick,
you can purge them. If it was shared with anything else, surgically
remove only streamlick:

```bash
# Surgical removal (recommended)
rm -rf /opt/streamlick /var/www/streamlick /srv/streamlick
rm -f /etc/systemd/system/streamlick*.service
rm -f /etc/nginx/sites-enabled/streamlick.conf /etc/nginx/sites-available/streamlick.conf
crontab -l | grep -v streamlick | crontab -
systemctl daemon-reload
```

Don&rsquo;t reboot yet. We&rsquo;ll bring up the new app first, then
verify, then clean up the rest.

## Phase 2 — bootstrap

The repo includes everything needed:

```bash
# As root
cd /tmp
git clone https://github.com/mikeisflux/indiecomicslive.git
cd indiecomicslive
sudo bash scripts/setup-server.sh
```

What this does (from `scripts/setup-server.sh`):

- Installs Node 22, nginx, certbot, postgres-client, ufw, iptables.
- Creates the `icl` system user and `/opt/indiecomicslive` directory.
- Opens ports 22 / 80 / 443 in ufw.
- Installs the bot-blocker watcher + sync + manual scripts (with
  `/etc/default/botblock-sync` stub) and starts the watcher service.
- Adds the 5-minute botblock-sync cron entry.
- Configures logrotate.

## Phase 3 — clone + configure

```bash
# Move the clone into place
mv /tmp/indiecomicslive /opt/indiecomicslive
chown -R icl:icl /opt/indiecomicslive

# Drop the env file in
sudo -u icl tee /opt/indiecomicslive/.env.local >/dev/null <<'EOF'
NEXT_PUBLIC_SITE_URL=https://indiecomicslive.com

DATABASE_URL=<your DB URL>

AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://indiecomicslive.com

AUTH_RESEND_KEY=re_xxx
AUTH_EMAIL_FROM=noreply@indiecomicslive.com

ANT_MEDIA_HOST=stream.indiecomicslive.com
ANT_MEDIA_PORT=5443
ANT_MEDIA_APP=WebRTCAppEE
ANT_MEDIA_JWT_SECRET=<value also set in the panel>
ANT_MEDIA_WEBHOOK_SECRET=<value also set in the panel>
ANT_MEDIA_REST_USER=<panel admin user>
ANT_MEDIA_REST_PASS=<panel admin password>
NEXT_PUBLIC_ANT_MEDIA_APP=WebRTCAppEE

NMI_SECURITY_KEY=<from merchant portal>
NMI_PUBLIC_KEY=<CollectJS public key>
NMI_WEBHOOK_SECRET=<from merchant portal>
NMI_ENVIRONMENT=production

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=indiecomicslive
R2_PUBLIC_URL=

TURN_HOST=turn.indiecomicslive.com
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_REALM=indiecomicslive.com
TURN_SHARED_SECRET=<same as coturn static-auth-secret>
TURN_TTL_SECONDS=21600

BANK_ACCOUNT_ENCRYPTION_KEY=<openssl rand -base64 32>

WS_PORT=3001
NEXT_PUBLIC_WS_URL=wss://indiecomicslive.com/ws
EOF
sudo chmod 600 /opt/indiecomicslive/.env.local
sudo chown icl:icl /opt/indiecomicslive/.env.local
```

Also fill in `/etc/default/botblock-sync` with your DB credentials so
the cron sync can reconcile blocked IPs:

```bash
sudo tee /etc/default/botblock-sync >/dev/null <<EOF
PG_HOST=<host>
PG_USER=<user>
PG_PASS=<pass>
PG_DB=<db>
EOF
sudo chmod 600 /etc/default/botblock-sync
```

## Phase 4 — install systemd + nginx + cert

```bash
APP_HOST=indiecomicslive.com ADMIN_EMAIL=trust@indiecomicslive.com \
  sudo bash /opt/indiecomicslive/scripts/install-systemd.sh
```

What this does:

- Copies `helpfulapps/systemd/indiecomicslive.service` and
  `indiecomicslive-ws.service` to `/etc/systemd/system/`.
- Templates `helpfulapps/nginx/indiecomicslive.conf` with the hostname
  and links it under `sites-enabled/`. Removes the default nginx site.
- Calls `certbot --nginx` to obtain the Let&rsquo;s Encrypt cert for
  apex + www.

If certbot fails, DNS isn&rsquo;t pointing at the box yet (or port 80
isn&rsquo;t open). Confirm `dig indiecomicslive.com` shows the box&rsquo;s
public IP and `ufw status | grep 80` shows allow.

## Phase 5 — first deploy

```bash
sudo -u icl bash /opt/indiecomicslive/scripts/deploy.sh
```

That script runs `npm ci`, `prisma generate`, `prisma migrate deploy`,
`next build`, then `systemctl restart` for the app + ws units. It
fails fast on a non-running service so you can `journalctl -u …` the
moment something goes sideways.

Verify by hand:

```bash
sudo systemctl status indiecomicslive.service indiecomicslive-ws.service
curl -I https://indiecomicslive.com
sudo journalctl -u indiecomicslive.service -n 50
```

## Phase 6 — bootstrap your admin account

```bash
# Visit https://indiecomicslive.com, sign in with your email (magic link).
# Then on the box:
cd /opt/indiecomicslive
sudo -u icl npx tsx scripts/grant-admin.ts you@yourdomain.com super
```

Now you can log in and visit `/admin`.

## Phase 7 — verify everything

`/admin/settings` &mdash; the &ldquo;Streaming health&rdquo; panel
should show three green cards:

- **Ant Media**: reachable + version returned. If red, run the
  streaming-server runbook (the JWT secret + webhook URL must match).
- **TURN**: OK. If red, run the turn-server runbook.
- **Webhook signing**: OK.

Do the end-to-end test:

1. `/seller/apply` &rarr; submit your own application.
2. From `/admin/seller-applications/<id>` &rarr; approve.
3. `/seller` &rarr; create show.
4. `/seller/<id>` &rarr; Browser broadcast &rarr; Go live.
5. From a different browser/device, `/s/<id>` &rarr; you should see
   yourself within ~1 second.
6. Add a lot, start it, place a bid, let it close.
7. The order should appear under `/orders` and (if PaymentCloud is in
   live mode) be charged automatically. If it&rsquo;s in sandbox, mark
   the lot test-only and skip the charge expectation.

If all six steps pass, you&rsquo;re live.

## Phase 8 — cutover DNS

If you used a temp hostname (e.g. `new.indiecomicslive.com`), now flip
the apex:

1. Lower `indiecomicslive.com` TTL to 300 in your DNS provider 24
   hours BEFORE the cutover.
2. On cutover day, change the A/AAAA record to the new app box.
3. `dig +short indiecomicslive.com @1.1.1.1` from a few networks to
   confirm propagation.
4. Open `https://indiecomicslive.com` in an incognito window.

## Phase 9 — finalize

After the new setup has been live for 24 hours without issues:

```bash
# Disable the old streamlick units (irreversible)
systemctl disable streamlick.service streamlick-worker.service 2>/dev/null
rm -rf /opt/streamlick.bak

# Drop snapshot retention to one before deleting all the rest
```

Run the corresponding finalize phases in:

- `docs/runbooks/streaming-server-reset.md` (Phase 5/6)
- `docs/runbooks/turn-server-reset.md` (Phase 6)

## Operating notes

### Pulling a new version

```bash
sudo -u icl bash /opt/indiecomicslive/scripts/deploy.sh
```

That&rsquo;s it. Same script every time.

### Tailing logs

```bash
sudo journalctl -u indiecomicslive.service -f
sudo tail -f /var/log/indiecomicslive/app.log
sudo tail -f /var/log/indiecomicslive/ws.log
sudo tail -f /var/log/botblock-watcher.log
```

### Rotating a secret

1. Generate a new value (`openssl rand -base64 …`).
2. Update `/opt/indiecomicslive/.env.local`.
3. Restart: `sudo systemctl restart indiecomicslive.service indiecomicslive-ws.service`.

For Ant Media JWT secret: change the panel value too (Settings &rarr;
Application &rarr; JWT Stream Security Settings) and restart the
Ant Media app. For TURN: change `static-auth-secret` in
`/etc/turnserver.conf` on the TURN box and `systemctl restart coturn`.

### Rolling back

If a deploy goes sideways:

```bash
cd /opt/indiecomicslive
sudo -u icl git log --oneline -10                   # find the last good commit
sudo -u icl git checkout <good-sha>
sudo -u icl bash scripts/deploy.sh
```

### Common issues

- **502 Bad Gateway from nginx.** The Next.js process didn&rsquo;t
  start. Check `journalctl -u indiecomicslive.service -n 100`.
- **WebSocket fails to connect from the browser.** Likely the nginx
  `/ws` route or `proxy_set_header Upgrade` is wrong. Verify
  `helpfulapps/nginx/indiecomicslive.conf` is what&rsquo;s actually
  deployed (`cat /etc/nginx/sites-enabled/indiecomicslive.conf`).
- **`/api/turn-credentials` returns only STUN.** `TURN_HOST` or
  `TURN_SHARED_SECRET` is unset. Check `.env.local` and
  `/admin/settings`.
- **Bot blocker not adding iptables rules.** `botblock-watcher` not
  running as root. `sudo systemctl status botblock-watcher`. Verify
  `/tmp/botblock-pending` is writable by the `icl` user.
