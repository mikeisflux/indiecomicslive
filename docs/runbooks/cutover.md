# Cutover — streamlick &rarr; indiecomicslive

The master order. Each line links to a more detailed runbook. Don&rsquo;t
skip phases; each one builds on the last.

## Pre-flight (do once, before touching servers)

- [ ] Snapshot all three boxes (app, TURN, Ant Media).
- [ ] Stand up Postgres for the new app. Easiest: Neon (`neon.tech`,
      60 sec). Copy the connection string somewhere safe.
- [ ] Generate every secret in one shot:
      ```bash
      for n in AUTH BANK_ACCOUNT_ENCRYPTION ANT_MEDIA_JWT \
               ANT_MEDIA_WEBHOOK NMI_WEBHOOK TURN_SHARED; do
        echo "$n=$(openssl rand -base64 32)"
      done
      ```
- [ ] Lower DNS TTLs on `indiecomicslive.com` to 300 (5 min). Wait
      24h for the old TTL to expire before cutover.
- [ ] Get the Mux/PaymentCloud creds + R2 keys + SendGrid key handy.

## Phase A — TURN box (no app dependency)

Wipe + reconfigure coturn. Doesn&rsquo;t affect anything else yet.

&rarr; **`docs/runbooks/turn-server-reset.md`** (all phases)

After Phase 5d of that runbook, the box is ready and serving TURN at
`turn.indiecomicslive.com`. The old streamlick TURN is gone.

## Phase B — Ant Media box (in-place, no wipe)

Reconfigure the panel. The box keeps running; we&rsquo;re just
re-pointing it at the new app.

&rarr; **`docs/runbooks/streaming-server-reset.md`** Phases 0&ndash;3
only. Skip Phase 4&ndash;6 until the new app is live.

After Phase 3 of that runbook, the Ant Media box has:

- New JWT secret matching `ANT_MEDIA_JWT_SECRET`
- New webhook URL pointing at `https://indiecomicslive.com/api/webhooks/antmedia`
- DNS for `stream.indiecomicslive.com` pointing at it
- A fresh SSL cert

## Phase C — App server (the big one)

Wipe the streamlick app box, install Node + nginx + bot-blocker,
deploy the indiecomicslive app, get the cert.

&rarr; **`docs/runbooks/app-server-deploy.md`** Phases 0&ndash;7.
Don&rsquo;t cut over DNS yet (Phase 8).

When you finish Phase 7, you have a fully working stack accessible
either by IP or temp hostname.

## Phase D — Verify

On the running but pre-cutover app, all four of these must work:

- [ ] `/admin/settings` shows green for Ant Media + TURN + Webhook
      signing.
- [ ] Sign in &rarr; pick handle &rarr; `/seller/apply` &rarr;
      approve via `/admin/seller-applications` &rarr; create show
      &rarr; go live in browser broadcast.
- [ ] On a different device, view the show; verify sub-second
      latency.
- [ ] Add a lot, start it, place a bid, let it close. Order appears
      under `/orders`.

If any of these fail, **do not cut over.** Diagnose first; the green
lights mean rollback is still trivial.

## Phase E — DNS cutover

```bash
# Update A/AAAA records:
indiecomicslive.com           A   <new app box IP>
www.indiecomicslive.com       CNAME indiecomicslive.com
stream.indiecomicslive.com    A   <Ant Media box IP>
turn.indiecomicslive.com      A   <TURN box IP>
```

Wait for propagation (`dig +short indiecomicslive.com @1.1.1.1`).
Open in an incognito window. Repeat the verification list from
Phase D against the public hostname.

## Phase F — Watch for 24h

- Tail logs: `journalctl -u indiecomicslive.service -f`
- Watch `/admin/audit` for any unexpected actions.
- Watch `/admin/bot-block` to confirm the firewall is reacting if
  scanners hit you.
- Watch `/admin` dashboard metrics for any anomaly.

## Phase G — Cleanup (irreversible)

After the new setup has been stable for 24 hours:

- Streaming box: **`docs/runbooks/streaming-server-reset.md`** Phases
  4&ndash;6 (delete old streamlick apps + recordings + DNS).
- TURN box: **`docs/runbooks/turn-server-reset.md`** Phase 6 (delete
  backup config + old user DB).
- Old streamlick DNS records: remove `*.streamlick.com`.
- Snapshots: keep the pre-cutover ones for at least 7 days, then
  prune.

## Rollback

| Stage | If broken before this stage | Fix |
|---|---|---|
| Phase A | TURN | Restore from snapshot or `cp /etc/turnserver.conf.streamlick.bak` |
| Phase B | Ant Media | Revert JWT + webhook in the panel using values from your snapshot notes |
| Phase C | App | App not yet at indiecomicslive.com &mdash; just point DNS to the old box |
| Phase E | After DNS swap | Lower TTL was the safety net. Flip A record back to old box, wait 5 min |
| Phase G | Post-cleanup | Snapshot is the only recovery |

## Files in this repo that matter for the deploy

| Path | Purpose |
|---|---|
| `scripts/setup-server.sh` | One-shot bootstrap (Node, nginx, ufw, bot-blocker) |
| `scripts/install-systemd.sh` | systemd units + nginx site + cert |
| `scripts/deploy.sh` | Pull, build, migrate, restart |
| `scripts/grant-admin.ts` | Promote a user to admin |
| `helpfulapps/systemd/*.service` | systemd units for app + ws |
| `helpfulapps/nginx/indiecomicslive.conf` | Reverse proxy with WSS support |
| `helpfulapps/botblock-firewall/` | Watcher + sync + manual scripts |
| `prisma/schema.prisma` | DB schema |
| `.env.example` | Every env var documented |
