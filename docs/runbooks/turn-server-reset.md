# TURN server reset (coturn)

Repurpose the box previously running coturn for Streamlick so Indie
Comics Live&rsquo;s WebRTC sessions can use it. Each phase is
reversible until Phase 4 (delete).

## Before you start

- SSH to the TURN box.
- Target hostname (e.g. `turn.indiecomicslive.com`).
- DNS access for that hostname.
- SSL cert for that hostname (Let&rsquo;s Encrypt is fine).
- A 32+ char `TURN_SHARED_SECRET` (matches what&rsquo;s in the app `.env`).

## Phase 0 — snapshot

Same as the streaming runbook. Do not skip this.

## Phase 1 — inventory

```bash
# Is coturn running?
systemctl status coturn

# Where's the config?
ls -la /etc/turnserver.conf /etc/coturn/turnserver.conf 2>/dev/null

# Is there a user database (long-term-credential mode)?
ls -la /etc/turnuserdb.conf /var/lib/coturn/turndb 2>/dev/null

# Active listeners (look for 3478, 5349, 5766)
ss -tulnp | grep turn

# What's coturn actually using right now?
ps -ef | grep turnserver
```

Save a copy of the existing config:

```bash
cp /etc/turnserver.conf /etc/turnserver.conf.streamlick.bak
```

## Phase 2 — stop coturn

```bash
systemctl stop coturn
```

Verify nothing&rsquo;s on 3478 / 5349 anymore:

```bash
ss -tulnp | grep -E '3478|5349'
```

## Phase 3 — write the new config

Replace `/etc/turnserver.conf` with the following. Anything in
`<angle brackets>` is a placeholder you must fill in.

```ini
# /etc/turnserver.conf  —  Indie Comics Live

# Network
listening-port=3478
tls-listening-port=5349
listening-ip=<public-ipv4>
relay-ip=<public-ipv4>
external-ip=<public-ipv4>
# If you have IPv6, add:
# listening-ip=<public-ipv6>
# external-ip=<public-ipv6>

# Auth — we use the REST-API / use-auth-secret pattern.
# This MUST match TURN_SHARED_SECRET in the indiecomicslive .env.
use-auth-secret
static-auth-secret=<your TURN_SHARED_SECRET>
realm=indiecomicslive.com

# Performance & safety
fingerprint
no-multicast-peers
no-loopback-peers
no-tcp-relay
no-cli
total-quota=200
user-quota=50
stale-nonce=600

# Relay UDP port range (open these in your firewall)
min-port=49152
max-port=65535

# TLS — point at the cert+key for turn.indiecomicslive.com
cert=/etc/letsencrypt/live/turn.indiecomicslive.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.indiecomicslive.com/privkey.pem

# Logs
log-file=/var/log/coturn/turn.log
simple-log
verbose
# Drop verbose once you've verified everything works.
```

Make sure the cert files exist and are readable by the `turnserver`
user:

```bash
sudo chown -R turnserver:turnserver /etc/letsencrypt/live/turn.indiecomicslive.com
```

If `turnserver` user can&rsquo;t cd through `/etc/letsencrypt/live`,
either chmod the directory or symlink the files into a path it can
read. Don&rsquo;t world-readable the privkey.

## Phase 4 — firewall

```bash
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 5349/tcp
ufw allow 49152:65535/udp
ufw reload
```

If you&rsquo;re on a cloud provider with a security-group / firewall
overlay (AWS, GCP, Hetzner Cloud Firewall), open the same ports there
too.

If the box is behind NAT (most clouds are), `external-ip` in
`turnserver.conf` MUST be the public IP, not the private one — coturn
hands out candidates with that IP, and clients can&rsquo;t reach
private addresses.

## Phase 5 — start + verify

```bash
systemctl daemon-reload
systemctl start coturn
systemctl status coturn

# Tail the log to watch the first connection:
tail -f /var/log/coturn/turn.log
```

### 5a. Smoke test the credentials

Generate a credential the same way the app does:

```bash
EXP=$(($(date +%s) + 3600))
SECRET="<your TURN_SHARED_SECRET>"
USER="$EXP:test"
PASS=$(echo -n "$USER" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)
echo "username=$USER"
echo "password=$PASS"
```

### 5b. Verify reachability

From outside (your laptop, a different cloud):

```bash
# Trickle ICE test (returns "1" line per ICE candidate gathered)
turnutils_uclient -v -u "$USER" -w "$PASS" -p 3478 turn.indiecomicslive.com
```

If you see `srflx` and `relay` candidates, TURN is working. If you
only see `host`, the firewall is blocking UDP relay range or
`external-ip` is wrong.

### 5c. Browser test

Use [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):

1. Add ICE server: `turn:turn.indiecomicslive.com:3478?transport=udp`,
   the username and password from 5a.
2. &ldquo;Gather candidates.&rdquo; You should see a `relay`
   candidate.
3. Repeat with `turns:turn.indiecomicslive.com:5349?transport=tcp` and
   confirm a relay candidate appears (this proves TLS port is open
   too).

### 5d. End-to-end test in Indie Comics Live

1. Set in the app `.env`:
   ```
   TURN_HOST=turn.indiecomicslive.com
   TURN_PORT=3478
   TURN_TLS_PORT=5349
   TURN_REALM=indiecomicslive.com
   TURN_SHARED_SECRET=<same value as static-auth-secret>
   ```
2. Restart the Next.js app.
3. Sign in. Open `/api/turn-credentials` directly in the browser.
   Should return JSON with at least one `turn:` and one `turns:` URL.
4. Visit `/admin/settings`. The TURN section should report **OK**.
5. Stream a show, open `chrome://webrtc-internals`, find the
   connection, look for a candidate of type `relay`. (If your home
   network has a friendly NAT you may not see one — the relay only
   gets used when ICE direct fails.)

## Phase 6 — delete old Streamlick artifacts

Only after Phase 5d passes:

```bash
# Remove the Streamlick backup and any old user database
rm -f /etc/turnserver.conf.streamlick.bak
rm -f /etc/turnuserdb.conf

# If coturn was using a sqlite user DB:
rm -f /var/lib/coturn/turndb

# Remove old logs (the new ones will start clean)
truncate -s 0 /var/log/coturn/turn.log
```

If the old DNS record `turn.streamlick.com` is no longer wanted,
remove it from your DNS provider after waiting a TTL or two.

## Phase 7 — rotate + harden

```bash
# Disable verbose logging now that you've verified things
sed -i 's/^verbose/#verbose/' /etc/turnserver.conf
systemctl reload coturn

# Rotate the shared secret on a schedule (every 90 days is fine).
# Update both /etc/turnserver.conf AND the app's TURN_SHARED_SECRET
# at the same time, then `systemctl restart coturn` and restart the app.
```

## Rollback

```bash
# Restore the Streamlick config
cp /etc/turnserver.conf.streamlick.bak /etc/turnserver.conf
systemctl restart coturn
```

If you&rsquo;ve already done Phase 6, restore from the Phase 0 snapshot.

## Common issues

- **`relay` candidates never appear.** `external-ip` is probably
  wrong (set to private IP). Check `curl ifconfig.me` from the box
  and make sure that&rsquo;s in `external-ip`.
- **`turns:` (TLS) doesn&rsquo;t work but `turn:` does.** Cert path
  is wrong, cert is unreadable to the `turnserver` user, or the cert
  doesn&rsquo;t match the hostname clients are connecting to.
- **&ldquo;401 unauthorized&rdquo; in coturn logs.** Usernames must
  be `<expiry-unix>:<id>` and the password must be base64 of
  HMAC-SHA1, exactly. Check the order of operations in
  `src/lib/turn.ts` &mdash; this is by-the-book.
- **Bursty UDP failures.** Default `total-quota=200` may be too low.
  Bump it. coturn is single-threaded for relay logic; under heavy
  load consider scaling vertically rather than horizontally.
