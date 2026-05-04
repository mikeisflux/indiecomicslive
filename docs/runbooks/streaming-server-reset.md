# Streaming server reset (Ant Media)

Repurpose the box previously running the Streamlick stack so Indie
Comics Live can use it. **Do not run this start to finish without
reading.** Each phase is reversible up until the &ldquo;Phase 4:
delete Streamlick&rdquo; step.

## Before you start

You will need:

- SSH access to the streaming box (root or a user with `sudo`).
- The new app&rsquo;s public host (e.g. `https://indiecomics.live`).
- A 32+ char shared secret for JWT (`ANT_MEDIA_JWT_SECRET`).
- A 32+ char shared secret for stream webhooks (`ANT_MEDIA_WEBHOOK_SECRET`).
- A target hostname for the streaming box (e.g. `stream.indiecomics.live`).
- DNS access to point that hostname at the box.
- An SSL cert for that hostname (Let&rsquo;s Encrypt is fine).

## Phase 0 — snapshot (mandatory)

```bash
# Hetzner Cloud
hcloud server create-image --type snapshot --description "pre-icl-reset $(date -u +%FT%TZ)" <server-name>

# DigitalOcean
doctl compute droplet-action snapshot <droplet-id> --snapshot-name "pre-icl-reset"

# AWS EC2
aws ec2 create-snapshot --volume-id <vol-id> --description "pre-icl-reset"

# OVH / bare metal: take a filesystem-level snapshot or rsync
# /usr/local/antmedia and /etc to a backup host before continuing.
```

Verify the snapshot exists in your provider&rsquo;s console before
moving on.

## Phase 1 — inventory what&rsquo;s there

```bash
# What systemd units are running?
systemctl list-units --type=service --state=running

# What's installed under /opt and /usr/local?
ls -la /opt /usr/local

# Active network listeners (look for 5443, 1935, 8080, etc.)?
ss -tlnp

# Anything Streamlick-specific in /var/www, /srv, or home dirs?
find / -maxdepth 4 -iname '*streamlick*' 2>/dev/null

# Ant Media install location (Community Edition default):
ls /usr/local/antmedia
```

Write down what you find. We&rsquo;re keeping Ant Media itself; we&rsquo;re
just re-pointing it at the new app.

## Phase 2 — stop Streamlick services (reversible)

If the Streamlick app was deployed on this same box:

```bash
# Stop, don't disable yet
systemctl stop streamlick.service        # or whatever the unit was named
systemctl stop streamlick-worker.service # if there were workers

# Confirm nothing is binding the old ports
ss -tlnp | grep -E '3000|3001|8080'
```

Leave the files on disk for now. We&rsquo;ll only delete them in Phase 4
once the new app is verified working.

## Phase 3 — reconfigure Ant Media for Indie Comics Live

### 3a. JWT Stream Security

Open the Ant Media web panel: `https://<stream-host>:5443/`.

```
1. Sign in (default admin/admin if never changed — change it).
2. Settings → Application → WebRTCAppEE
   (or whatever app name you'll use; default is WebRTCAppEE).
3. Find "JWT Stream Security Settings".
4. Enable both "Stream Publish JWT Filter" and "Stream Play JWT Filter".
5. Set JWT Secret to your ANT_MEDIA_JWT_SECRET value.
6. Save. Restart the app from the panel ("Restart").
```

This must match `ANT_MEDIA_JWT_SECRET` in the indiecomicslive `.env`.

### 3b. Stream webhook

```
1. Settings → Application → WebRTCAppEE → "Stream Webhook URL"
2. Set URL to: https://<your-app-host>/api/webhooks/antmedia
3. Set webhook secret to your ANT_MEDIA_WEBHOOK_SECRET value.
4. Save + Restart.
```

The `verifyAntMediaWebhook` helper in `src/lib/antmedia.ts` validates
the `X-AMS-Signature` header against this secret.

### 3c. CORS (only if needed)

If the browser will load assets directly from the streaming box (it
will — `webrtc_adaptor.js` is loaded as a `<script>`), make sure the
streaming domain serves the JS without a restrictive CORS policy.
Ant Media&rsquo;s default config is fine; only intervene if you added
custom nginx in front.

### 3d. Disable apps you&rsquo;re not using

In Ant Media&rsquo;s panel, find the Applications list. We use
**WebRTCAppEE** only. If `LiveApp`, `WebRTCApp`, or any custom
Streamlick-named app is present, either delete or stop them so
nobody can publish through stale endpoints.

### 3e. DNS

Update DNS for your chosen streaming hostname (e.g.
`stream.indiecomics.live`) to point at the box. Wait for propagation
(`dig stream.indiecomics.live`). Replace the cert in
`/usr/local/antmedia/conf` if Ant Media is doing TLS termination, or
in your reverse proxy if there is one.

If you&rsquo;re reusing the existing `stream.streamlick.com`
hostname for a few days, that&rsquo;s fine — set
`ANT_MEDIA_HOST=stream.streamlick.com` in the app `.env` and migrate
later.

### 3f. Set the `.env` on the app box

```
ANT_MEDIA_HOST=stream.indiecomics.live
ANT_MEDIA_PORT=5443
ANT_MEDIA_APP=WebRTCAppEE
ANT_MEDIA_JWT_SECRET=<the value from 3a>
ANT_MEDIA_WEBHOOK_SECRET=<the value from 3b>
ANT_MEDIA_REST_USER=<panel admin username>
ANT_MEDIA_REST_PASS=<panel admin password>
NEXT_PUBLIC_ANT_MEDIA_APP=WebRTCAppEE
```

Restart the Next.js app + WS server.

### 3g. Firewall

```bash
# Required for browser viewers + publishers
ufw allow 5443/tcp     # HTTPS / WSS
ufw allow 1935/tcp     # RTMP (OBS publish)

# WebRTC media (UDP). Ant Media uses 50000-60000 by default.
# Check current setting in /usr/local/antmedia/conf/red5.properties
ufw allow 50000:60000/udp
ufw reload
```

If Ant Media is behind a cloud load balancer, configure the same
ports there.

## Phase 4 — verify before deleting anything

### 4a. Smoke test from another box

```bash
# Should return JSON with versionType + versionName
curl -k https://<stream-host>:5443/<app>/rest/v2/version

# Should return JSON ICE servers list (when authenticated as a real user)
curl https://<your-app-host>/api/turn-credentials

# Webhook signature self-check (run on the app box):
curl -X POST https://<your-app-host>/api/webhooks/antmedia \
  -H "X-AMS-Signature: sha256=<wrong>" \
  -H "Content-Type: application/json" \
  -d '{"id":"test","action":"liveStreamStarted"}'
# Expect: 401 bad_signature
```

### 4b. Check the /admin/settings panel

Visit `/admin/settings` on the new app. The &ldquo;Streaming&rdquo;
section should show the Ant Media REST endpoint as **reachable**. If
it shows **unreachable**, fix that before deleting Streamlick files.

### 4c. End-to-end stream test

1. Sign in to the new app, complete `/seller/apply`, get yourself
   approved (use the `grant-admin.ts` script + `/admin/seller-applications`).
2. Create a show. Open `/seller/<id>` &rarr; Browser broadcast tab.
3. Click &ldquo;Go live.&rdquo; Browser asks for cam+mic permission.
4. In another tab, open `/s/<id>`. You should see yourself within 1
   second.
5. Open `chrome://webrtc-internals` and confirm the selected ICE
   candidate pair includes either `srflx` (STUN) or `relay` (TURN).
6. Stop the stream. The webhook should fire and `show.status` should
   flip to `ended` in the DB. Confirm in `/admin/shows`.

If all five steps work, the new setup is verified. Move to Phase 5.

## Phase 5 — delete Streamlick artifacts (irreversible)

### 5a. Disable + remove old systemd units

```bash
# Replace 'streamlick' with whatever names you found in Phase 1
systemctl stop streamlick.service streamlick-worker.service 2>/dev/null
systemctl disable streamlick.service streamlick-worker.service 2>/dev/null
rm -f /etc/systemd/system/streamlick*.service
systemctl daemon-reload
```

### 5b. Remove app code

```bash
# Find Streamlick install paths from Phase 1 inventory
rm -rf /opt/streamlick /var/www/streamlick /srv/streamlick

# Remove node_modules, build artifacts, logs
find / -maxdepth 5 -path '/proc' -prune -o -iname '*streamlick*' -print 2>/dev/null
# Review the list before piping into rm.
```

### 5c. Remove old Ant Media apps

In the Ant Media panel:

```
Applications → (select any Streamlick-specific app) → Delete
```

This also removes their per-app config + recorded streams. **Take a
disk snapshot first if any of those recordings have value.**

### 5d. Remove old recordings

```bash
# WebRTCAppEE default location
du -sh /usr/local/antmedia/webapps/WebRTCAppEE/streams
# Inspect, then if you're sure none are needed:
rm -rf /usr/local/antmedia/webapps/WebRTCAppEE/streams/*
```

### 5e. Rotate any leaked secrets

If the old JWT secret or webhook secret might be in any committed
Streamlick repo, generate fresh values and re-do steps 3a + 3b with
the new values.

### 5f. Clean up DNS

If `stream.streamlick.com` is no longer in use, remove that DNS
record. If you&rsquo;re keeping it pointed at the same box for
historical links, that&rsquo;s fine, but make sure no Streamlick-
specific app is still serving content on that hostname.

## Phase 6 — harden

```bash
# Change Ant Media admin password if you haven't already
# (Settings → Server Settings → Username/Password)

# Ban panel access from public internet — front it with VPN or
# IP-allowlist via your reverse proxy / firewall:
ufw deny 5080/tcp                  # Ant Media admin panel HTTP
# OR limit to your office IP:
ufw allow from <your-ip> to any port 5080 proto tcp

# Logs aren't free; rotate them
ls /usr/local/antmedia/log
# Verify logrotate.d entry exists for ant-media-server
```

## Rollback

If anything goes wrong before Phase 5:

```bash
# Stop the new config
systemctl stop antmedia.service

# Restore the Phase 0 snapshot from your provider's console
# OR
# Revert turnserver.conf and the JWT/webhook settings in the
# panel using the values you wrote down before changes.
```

After Phase 5 the snapshot is your only rollback path.
