# Indie Comics Live — project context

Persistent notes for Claude. Read this on every session start before making changes.

## What this is

- **Indie Comics Live** (`indiecomicslive.com`) — live-auction marketplace for indie comics, NSFW art books, trading cards.
- Operated by **Divinity Comics Inc.**, an Indiana nonprofit corporation. Indie Comics Live is a wholly operated subsidiary brand.
- Sister project: **Indiecrowdfund** (separate repo, same parent org).

## Stack

- **Next.js (App Router)** — `src/app/**`
- **Prisma + Postgres** — `prisma/schema.prisma`
- **Auth.js** for sessions
- **Ant Media Server** for WebRTC livestreaming (self-hosted)
- **Cloudflare R2** for object storage
- **SendGrid** for outbound email + Inbound Parse for `admin/inbox`
- **WebSocket server** in `src/server/ws.ts` (auction state broadcast)

## Process manager: pm2 (NOT systemctl)

We run the app under **pm2**, not systemd. `scripts/deploy.sh` is now pm2-aware (rewrote it 2026-05-05; it builds first, refuses to restart if `.next/BUILD_ID` is missing, then `pm2 reload`s both procs). Typical ad-hoc commands:

```bash
pm2 list
pm2 restart indiecomicslive
pm2 restart indiecomicslive-ws
pm2 logs indiecomicslive --lines 200
pm2 logs indiecomicslive-ws --lines 200
```

Do **not** run `sudo systemctl restart indiecomicslive*` — that's the old setup.

### Run everything as `root` on prod

Production deploys + pm2 run as **root**. The repo dir, the pm2 daemon, and the cron entries all live under root. Any `sudo -iu icl` references in older snippets are stale — ignore them. If `git` ever complains about "dubious ownership," it means something got created by a different user; fix once with `chown -R root:root /opt/indiecomicslive` and add `git config --global --add safe.directory /opt/indiecomicslive` for root.

### Deploy block must be paste-safe

Never use `&& exit 1` patterns in deploy snippets — when pasted into an interactive ssh shell, `exit 1` terminates the user's session. Use `if/else` and let pm2-reload happen only on success.

## After every commit: deploy command block

**Whenever I commit + push, end the response with the exact copy-paste block below so the user can deploy.** Substitute the current branch name; default to whatever branch we just pushed to. Run it as **root** in `/opt/indiecomicslive` — no `sudo -iu icl`. The `if/else` at the end replaces any `&& exit 1` pattern; otherwise a failed build kicks the user out of their ssh session.

```bash
cd /opt/indiecomicslive

git checkout -- tsconfig.json 2>/dev/null || true
git fetch --all --prune
git checkout <BRANCH>
git pull --ff-only origin <BRANCH>

rm -rf .next
npm ci
npx prisma generate
npx prisma db push        # use 'migrate deploy' if a migrations/ folder is added later
npm run build

if [ -s .next/BUILD_ID ]; then
  echo "BUILD OK"
  pm2 reload indiecomicslive --update-env
  pm2 reload indiecomicslive-ws --update-env
  pm2 save
  pm2 list
else
  echo "BUILD FAILED — pm2 NOT reloaded; previous build still running."
fi
```

If the commit only changes site copy / legal text and there are no schema or dep changes, a faster path is `git pull && npm run build && pm2 reload all` — but the full block above always works and is safe to recommend by default.

## Payment processors

We have two processors in the codebase. The branding distinction is critical:

| Context                   | Use this name              | Don't use                   |
| ------------------------- | -------------------------- | --------------------------- |
| Internal code, env vars, lib paths, module names, admin UI, webhook routes | `DivinityCoin` / `divinitycoin` / `dc` | — |
| Public-facing legal docs, marketing copy, About page, /sell page, FAQ, emails | **`Divinity Payments`** | `DivinityCoin`, `divinitycoin`, `divinity coin` |

**Never expose `DivinityCoin` / `divinitycoin` to users.** The public brand is **Divinity Payments**.

### Important: DC API surface (last confirmed 2026-05-05)

DC's `/internal` partner API supports these actions:

| Method | Action | Use |
|---|---|---|
| GET | `health` | Connectivity / auth probe (used by Verify credentials) |
| GET | `settlements`, `settlement`, `captures` | Read settlement history |
| POST | `validate` | Redeem a gift-card code |
| POST | `balance` | Get user's credit balance |
| POST | `hold` / `release` / `capture` / `record_capture` | Credit-balance ops |
| POST | `create-payment-intent` | Interactive PaymentIntent (buyer present) |
| POST | `create-setup-intent` | Mint a Stripe SetupIntent so the buyer can save a card on file |
| POST | `list-payment-methods` | List a buyer's saved cards (with brand/last4/exp) |
| POST | `detach-payment-method` | Remove a saved card |
| POST | `charge-saved-payment-method` | **Off-session charge** of a previously saved card (auction wins) |
| POST | `refund` | Refund a payment |
| POST | `verify-payment` | Server-side confirm a payment |

#### Saved-card flow (auction MIT)

1. Buyer adds card → `POST /api/payment-methods/dc/intent` calls DC's `create-setup-intent` → returns `{ clientSecret, publishableKey }`.
2. Browser confirms via Stripe Elements; we get back a `pm_...` id.
3. `POST /api/payment-methods/dc/confirm` sends just the `paymentMethodId`; the server calls DC's `list-payment-methods` to pull metadata (brand, last4, exp), DC verifies it belongs to this platformUserId, and we persist into `UserPaymentMethod.vaultId`.
4. Auction win → `chargeOrder()` in `src/lib/payments.ts` calls DC's `charge-saved-payment-method` with `{ platformUserId, paymentMethodId, amount, pledgeId: order.id, projectId: order.lotId }`. `pledgeId` is the idempotency key — retrying with the same value returns the same charge.
5. Decline returns HTTP 402 with `code` and `declineCode`; surface to admin.

The seller chargeback-recovery card uses the same flow under `/api/seller/chargeback-card/dc/*`.

#### Why `pledgeId` / `projectId` are reused

DC's terminology comes from indiecrowdfund (its other partner). For us:
- `pledgeId` = `order.id` (auction win id)
- `projectId` = `order.lotId` (which lot was won)
DC doesn't validate the meaning, only that they're stable, unique strings.

### Legacy: PaymentCloud / NMI

- PaymentCloud (NMI) was the prior processor. The integration code is still in `src/lib/nmi.ts`, `src/components/payments/NmiCardForm.tsx`, etc.
- All public mentions of PaymentCloud / NMI / CollectJS have been removed from site documents (commented out in `TermsOfService.tsx` 6a "Rolling Reserve"; replaced elsewhere with "Divinity Payments").
- If PaymentCloud is brought back online, restore the commented section in `src/components/legal/TermsOfService.tsx` and re-add the brand mentions.

### Files to keep in sync if processor branding changes

Public-facing docs that name the processor:
- `src/app/about/page.tsx`
- `src/app/sell/page.tsx`
- `src/components/legal/PrivacyPolicy.tsx`
- `src/components/legal/CookiePolicy.tsx`
- `src/components/legal/BidderAgreement.tsx`
- `src/components/legal/SellerAgreement.tsx`
- `src/components/legal/PciCompliance.tsx`
- `src/components/legal/DataDeletionPolicy.tsx`
- `src/components/legal/FraudPolicy.tsx`
- `src/components/legal/TermsOfService.tsx`
- `src/components/legal/ChargebacksPolicy.tsx`

## Branch conventions

- `main` is the deploy branch.
- Feature work happens on `claude/*` branches (e.g. `claude/whatnot-clone-exploration-VxA1W`, `claude/merge-whatnot-exploration-MA9Pt`).
- Always confirm the branch with the user before pushing destructive history changes.

## Shipping (Shippo)

We run a **single master Shippo account** — one live API token in `.env.local` (`SHIPPO_API_KEY`). Carriers are connected inside Shippo's dashboard; their rates surface automatically through our `/rates` endpoint. Sellers don't connect their own Shippo; they print labels through our UI and Shippo bills our account for postage.

- Library: `src/lib/shippo.ts` (REST client with `Authorization: ShippoToken …`, helpers for `createShipment` / `createTransaction` / `refundTransaction` / `getTracking` / `parseShippingAddress` / `shipFromJsonToAddress`).
- Each seller stores their **return address** in `User.shipFromAddress` (JSON). Edit at `/seller/ship-from`.
- **Buy label flow** (two-step): `/seller/orders/[id]` → ShipForm → `POST /api/seller/orders/[id]/rates` (calls `POST /shipments`) → user picks a `rateId` → `POST /api/seller/orders/[id]/buy-label` (calls `POST /transactions`). Label PDF is fetched from Shippo's CDN and cached in R2 under `labels/<order-id>/...pdf`; re-served via `GET /api/seller/orders/[id]/label.pdf` (presigned R2 redirect).
- **Bundle flow**: `POST /api/seller/shipments/[id]/buy-label` follows the same shape against a `Shipment` (one Shippo transaction, tracking denormalized onto every linked Order).
- Buying a label sets `Order.status='shipped'`, `shippedAt`, `trackingNumber`, `shippingCarrier`, `shippingService`, `shippingCostCents`, `shipstationShipmentId` (kept as a generic shipping-reference id; now stores Shippo's transaction `object_id`), `labelR2Key`.
- **Webhook**: `POST /api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>` consumes `track_updated` events. On `tracking_status.status === "DELIVERED"` we flip every Order with that tracking number to `delivered` and set `deliveredAt` (which makes the order payout-eligible). Configure in Shippo → Settings → API → Webhooks.

## Payouts (weekly Thursday)

Sellers are paid out weekly on Thursdays for orders that have been **tracking-confirmed delivered**. Money flows through DivinityCoin (`callDivinityCoinAPI("create_payout", ...)`).

- Library: `src/lib/payouts.ts` — `processWeeklyPayouts()` finds eligible orders, groups by seller, computes `net = gross - platform_fee + shipping_reimbursement`, creates a `Payout` row, dispatches via DC, marks orders with `payoutId`.
- Eligibility: `order.status === 'delivered' AND deliveredAt IS NOT NULL AND payoutId IS NULL`.
- Platform fee: `PLATFORM_FEE_BPS` env (default **600 = 6%**, intentionally 2 points under Whatnot's 8% commission). Stripe processing (~2.9% + $0.30) passes through at cost via DivinityCoin and is **not** included in this number — sellers see ~9% all-in vs Whatnot's ~11%.
- Cron: `POST /api/cron/payouts` with `Authorization: Bearer $CRON_SECRET`. Idempotent — safe to re-run for the same week. Wire as a system cron on the app server:
  ```
  0 13 * * 4 curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://indiecomicslive.com/api/cron/payouts >>/var/log/icl-payouts.log 2>&1
  ```

## Auth: email + password (no magic links)

- Sign-in: `/sign-in` — email + password, server action calls `signIn("credentials")`.
- Sign-up: `/sign-up` — email + password + name, server action hashes the password (scrypt via `src/lib/admin-password.ts`) and signs the user in.
- Forgot password: `/forgot-password` → `/reset-password?token=...`. The reset email is sent via SendGrid (`sendEmailRich`); the link points at our reset page (which renders a form), so the token is consumed only on POST and prefetchers can't blow through it.
- Provider: a single `Credentials` provider in `src/lib/auth.ts`. Has a side path for the env-configured admin (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`) that auto-promotes to `super_admin` on first login. Regular users authenticate against `User.passwordHash`.
- Magic-link / SendGrid email auth was removed (2026-05-05) — too many email-scanner prefetches consumed one-shot verification tokens before the human ever clicked.
- `trustHost: true` and `secret: process.env.AUTH_SECRET` are set explicitly so Auth.js works behind the nginx + Cloudflare proxy chain.
- `AUTH_DEBUG=1` toggles verbose Auth.js logs.

## reCAPTCHA v2

Enabled per-platform via `PlatformSetting.recaptchaEnabled` + `recaptchaSiteKey` + `recaptchaSecretKey`. Configure at `/admin/settings/recaptcha`.

- Library: `src/lib/recaptcha.ts` — `getRecaptchaSiteKey()` for forms (server-side), `verifyRecaptcha(token, ip)` for API/server-action verification. Cached for 30s.
- Component: `src/components/RecaptchaWidget.tsx` — drop-in widget; renders nothing if `siteKey` is null.
- Forms wired today: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/seller/apply`. Add it to any new public-facing form by passing `siteKey` to a client form, including the widget, and calling `verifyRecaptcha` on the server before any state change.
- Verifications short-circuit to `ok:true` when reCAPTCHA isn't enabled — useful in dev.

## Pending / planned work

- Optional daily Shippo tracking poll for any order whose webhook didn't reach us (defense-in-depth — the webhook handles delivered events today).
- Buyer-visible tracking page on `/orders/[id]`.
- Admin `/admin/payouts` page (run + history).

## Conventions

- TypeScript strict mode is on. Don't add `any` casually.
- No tests exist yet — verify changes by typecheck (`npx tsc --noEmit`) and `npm run build`.
- Don't add backward-compat shims unless asked.
- Keep comments scarce; prefer self-explanatory code.
