# Indie Comics Live

> The Whatnot alternative for adult-friendly creators — live auctions for indie comics, NSFW art books, and trading cards.

**Operated by Divinity Comics Inc.**, an Indiana nonprofit corporation. Indie Comics Live is a wholly operated subsidiary brand of Divinity Comics Inc.

Web-only PWA (no native apps, no app-store gatekeepers). High-risk-friendly payments via PaymentCloud, sub-second WebRTC streaming via self-hosted Ant Media. Built so adult-content creators don't get rugged by ToS changes.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19.2 + TS | RSC for show pages, route handlers for APIs |
| DB | PostgreSQL 17 + **Prisma 7.7** | Strict schema, transactional bids, generated types |
| Styling | Tailwind 4 (CSS-config) | |
| Auth | Auth.js v5 (Resend magic link) + `@auth/prisma-adapter` | No password storage |
| Live video | **Ant Media Server** (self-hosted, the `Anthill` fork) | Sub-second WebRTC, no NSFW AUP risk, no per-stream fees |
| Payments | **PaymentCloud / NMI** + CollectJS | High-risk-friendly; PAN tokenized in browser |
| Storage | Cloudflare R2 | Zero egress fees |
| Realtime | `ws` server (Node) + in-memory rooms | Auction state needs sub-second consistency |
| Encryption | AES-256-GCM (`@/lib/encryption`) | Seller bank-account PII at rest |
| PWA | manifest + service worker | iOS web push works on installed PWAs (16.4+) |

**Hosting:** the WS server needs a long-running Node process — Vercel won't work for that. Deploy the Next app + WS server together on Fly.io / Railway / Render / a Hetzner box. Ant Media runs separately.

## Corporate structure

- **Divinity Comics Inc.** — Indiana nonprofit corporation, the legal operator and merchant of record.
- **Indie Comics Live** — wholly operated subsidiary brand of Divinity Comics Inc.; auction marketplace covered by this codebase.
- Sister project: **Indiecrowdfund** — crowdfunding venue under the same parent.

This corporate structure is reflected throughout the legal pages (`/legal/*`) and the about page (`/about`).

## Project layout

```
prisma/
  schema.prisma                       # User, Account, VerificationToken,
                                      # Seller, SellerApplication,
                                      # PaymentCloudBankAccount (encrypted),
                                      # SellerChargebackCard, IPBlocklist,
                                      # UserAddress, Show, Lot, Bid, Order,
                                      # ChatMessage, UserPaymentMethod, Follow
src/
  app/
    page.tsx                          # Home — SEO hero, live + scheduled
    sell/                             # Seller landing (FAQ JSON-LD, CTAs)
    s/[id]/                           # Watch page (Ant Media WebRTC + chat + bid)
    seller/                           # Approved-seller dashboard
    seller/apply/                     # Multi-step apply-to-sell flow
    seller/[id]/                      # Per-show: Broadcast tab + Lots manager
    account/payment-method/           # Save/replace card via CollectJS
    onboarding/handle/                # Force handle pick after sign-in
    orders/                           # Buyer's order list
    orders/[id]/                      # Single order: status + retry-charge
    sign-in/                          # Magic-link sign-in
    about/                            # Divinity Comics Inc. + mission
    legal/                            # Hub + 16 individual policy pages
    sitemap.ts                        # Dynamic sitemap
    robots.ts                         # robots.txt allow public, disallow auth
    api/
      shows/                          # POST: create show (auto-issues publish/RTMP)
      shows/[id]/publish-token/       # GET: rotate Ant Media publish token
      shows/[id]/play-token/          # GET: short-lived play token
      lots/                           # POST: add lot
      lots/start/                     # POST: start next queued lot
      uploads/sign/                   # POST: signed R2 upload URL
      account/handle/                 # POST: pick / change handle
      seller/applications/            # GET / POST: seller-apply
      seller/bank-account/            # GET / POST: encrypted ACH details
      seller/chargeback-card/         # GET / POST: NMI vault for chargeback recoup
      admin/seller-applications/[id]/ # POST: approve | reject (admin only)
      payments/nmi/public-key/        # GET: CollectJS public key
      payment-methods/                # GET / POST: list, vault-and-save card
      orders/[id]/charge/             # POST: retry MIT charge
      webhooks/antmedia/              # liveStreamStarted / liveStreamEnded
      webhooks/nmi/                   # refund.success, chargeback.created
      auth/[...nextauth]/
  components/
    AntMediaPlayer.tsx
    AntMediaPublisher.tsx
    AgeGate.tsx                       # 18+ cookie gate (soft confirmation only)
    PWARegister.tsx
    Footer.tsx                        # Site-wide footer with full legal nav
    legal/
      Doc.tsx                         # Legal-doc shell (title, last-updated)
      TermsOfService.tsx
      PrivacyPolicy.tsx
      SellerAgreement.tsx
      BidderAgreement.tsx
      ContentGuidelines.tsx
      NsfwPolicy.tsx
      RefundPolicy.tsx
      ChargebacksPolicy.tsx
      ShippingPolicy.tsx
      DmcaPolicy.tsx
      FraudPolicy.tsx
      CookiePolicy.tsx
      GdprCcpaNotice.tsx
      DataDeletionPolicy.tsx
      AiPolicy.tsx
      PciCompliance.tsx
      index.ts                        # Slug → component registry
    payments/
      NmiCardForm.tsx                 # CollectJS inline-iframe form
      use-collectjs-iframe-verify.ts  # Two-strike iframe-attach verifier
  lib/
    prisma.ts                         # PrismaClient singleton
    auction.ts                        # placeBid, startNextLot, closeLot
    antmedia.ts                       # JWT publish/play tokens, URLs, webhook
    nmi.ts                            # PaymentCloud Direct Post (vault, sale, ...)
    payments.ts                       # chargeOrder (MIT vault charge on win)
    encryption.ts                     # AES-256-GCM (bank-account fields)
    legal.ts                          # Slug registry, brand constants
    r2.ts
    onboarding.ts                     # requireOnboardedUser helper
    auth.ts
    age-gate.ts
  server/
    ws.ts                             # WebSocket: chat + bids + 1s lot tick
public/
  manifest.webmanifest
  sw.js
```

## Setup

1. Copy env template:
   ```bash
   cp .env.example .env.local
   ```
   Required new env: `BANK_ACCOUNT_ENCRYPTION_KEY` (32 bytes base64 — `openssl rand -base64 32`).

2. Install:
   ```bash
   npm install
   ```

3. Set up Prisma (PG17):
   ```bash
   npm run db:migrate
   ```

4. Configure **Ant Media Server** (the `Anthill` fork):
   - In the panel: enable **JWT Stream Security Settings** → set the same secret as `ANT_MEDIA_JWT_SECRET`
   - Set **Stream Webhook URL** to `https://<host>/api/webhooks/antmedia` and the shared secret to `ANT_MEDIA_WEBHOOK_SECRET`

5. Configure **PaymentCloud / NMI**:
   - Copy the security key → `NMI_SECURITY_KEY`
   - Get the CollectJS public tokenization key → `NMI_PUBLIC_KEY`
   - Configure webhooks → `https://<host>/api/webhooks/nmi`, secret → `NMI_WEBHOOK_SECRET`

6. Run app + WS server:
   ```bash
   npm run dev:all
   ```

## Apply-to-sell flow

```
1. /sign-in → magic link
2. /onboarding/handle (forced; once)
3. /seller/apply (5 steps)
   ↓ Identity (legal name, DOB ≥18, address, phone)
   ↓ Business (store name, bio, social links, prior platforms,
   ↓          unfulfilled count, content categories, NSFW intent)
   ↓ Payouts (encrypted ACH bank account)
   ↓ Chargeback recovery card (NMI Customer Vault)
   ↓ Agreements (Seller Responsibility, Content Guidelines, NSFW if applicable)
4. POST /api/seller/applications
   ↓ auto-DQ rules: 3+ unfulfilled or any 1+yr past delivery
   ↓ otherwise: status=submitted
5. Admin approves at /api/admin/seller-applications/[id]
   ↓ creates Seller record + sets user role=seller
6. Approved seller can /seller and /seller/[id] to run shows
```

The auto-DQ thresholds (3+ unfulfilled / 1yr past delivery) are
ported from `indiecrowdfund_2.0/src/components/legal/creator-agreement.tsx`.

## How sellers stream

Every show gets `streamId = show.id` and a JWT publish token. Sellers go live via either tab on `/seller/[id]`:

**Browser broadcast** (one-click WebRTC)
- `AntMediaPublisher.tsx` fetches `/api/shows/[id]/publish-token`, loads `webrtc_adaptor.js` from the Ant Media host, calls `getUserMedia` for cam+mic, opens a WebSocket to `wss://<host>:<port>/<app>/websocket`, and publishes via WebRTC.
- Sub-second latency end to end. Best for a one-person live show with a webcam.

**Stream from OBS** (or any RTMP encoder)
- `ObsCredentials.tsx` renders the credentials inline:
  - **Server / URL**: `rtmp://<host>/<app>` (paste into OBS &rarr; Settings &rarr; Stream &rarr; Server)
  - **Stream Key**: `<show-id>?token=<jwt>` (paste into OBS &rarr; Stream Key)
- Reveal/copy/rotate buttons; token expiry shown.
- Slightly higher latency (~2-5s through the RTMP&rarr;WebRTC bridge) but supports multi-cam, lower-thirds, NDI sources, etc.

The Ant Media stream webhook (`liveStreamStarted` / `liveStreamEnded`) flips `show.status` automatically once frames start landing — that's what surfaces the show under "Live now" on the home page.

### TURN relay

Both the publisher and player fetch ICE servers from `/api/turn-credentials` on mount. Without a TURN server, ~10-15% of users behind symmetric NAT (mobile carriers, corporate firewalls) will fail to connect.

Configured via env (`TURN_HOST`, `TURN_PORT`, `TURN_TLS_PORT`, `TURN_REALM`, `TURN_SHARED_SECRET`, `TURN_TTL_SECONDS`). Uses **coturn's `use-auth-secret` mode** — server signs short-lived credentials with HMAC-SHA1; coturn validates the timestamp + HMAC without a DB lookup. Set `static-auth-secret` in coturn to the same value as `TURN_SHARED_SECRET`.

If `TURN_*` is unset, the API falls back to Google's public STUN — fine for development, not enough for production.

## Auction engine

`src/lib/auction.ts`:
- `placeBid` — Prisma `$transaction` with raw `SELECT ... FOR UPDATE` on the lot row. Validates lot is live, hasn't expired, bid >= current + min increment, bidder isn't already the high bidder. **Anti-snipe**: a bid in the last `softCloseSeconds` extends `endsAt`.
- `startNextLot` — flips next queued lot to `live`, sets `endsAt = now + duration`.
- `closeLot` — called by the WS server's 1-second tick. Marks `sold` (creates order, returns orderId) or `unsold`.

`src/lib/payments.ts`:
- `chargeOrder` — loads order + default vaulted card, calls `saleByVaultToken` with NMI's CIT/MIT credential-on-file flags. First charge tags `stored_credential_indicator="stored"` and records `initialTransactionId`; subsequent charges send `"used"` + the original txn id.

The WS server invokes `chargeOrder` async after `closeLot` and broadcasts an `order_charged` event.

## Legal docs

Sixteen policy components in `src/components/legal/`, all referencing **Divinity Comics Inc., an Indiana nonprofit corporation**:

- Terms of Service, Privacy Policy
- Seller Responsibility Agreement, Bidder Agreement
- Content Guidelines, NSFW Policy
- Refund Policy, Chargebacks Policy, Shipping Policy
- DMCA Policy, Fraud Prevention Policy
- Cookie Policy, GDPR & CCPA Notice, Data Deletion Policy
- AI Use Policy, PCI Compliance Statement

All wired to `/legal/<slug>` via `src/app/legal/[slug]/page.tsx`. The hub at `/legal` lists them all. The Footer (rendered on home / sell / about) links every doc.

When you materially change any of these, bump:
- `lastUpdated` in `src/lib/legal.ts`
- `AGREEMENT_VERSION` in `src/app/api/seller/applications/route.ts` so applicants re-prompt

## Admin section (`/admin`)

Role-gated control center. Only users with role `admin` or `super_admin` can access; everyone else gets redirected.

| Page | What it does |
|---|---|
| `/admin` | Dashboard — pending applications, live shows, GMV last 24h/7d, paid orders, refunds, chargebacks, locked users. |
| `/admin/seller-applications` | List + filter. Detail view shows identity, business, social links, prior platforms, bank, chargeback card, agreements; one-click approve/reject with audit-logged reviewer notes. |
| `/admin/sellers` | All approved sellers, quick stats (shows hosted, sold orders), account state. |
| `/admin/users` | Search by email/handle/name, filter by role/locked/deleted. Detail page exposes ban/unban, lock/unlock, chat-mute/unmute, role change, IP-block-from-last-known-IP. Every action audit-logged. |
| `/admin/shows` | All shows with status filter, click through to seller. |
| `/admin/orders` | List + status filter + search by id/email. Detail page exposes retry-charge (NMI MIT), full/partial refund (NMI), void, mark-shipped, mark-delivered, cancel. |
| `/admin/chargebacks` | Chargeback rate (30d), sellers ranked by chargeback count, full chargeback + refund tables. |
| `/admin/ip-blocks` | Manual IP/CIDR blocklist with optional expiry. |
| `/admin/audit` | Full audit log with actor / target / action filters. |
| `/admin/settings` | Read-only view of env-driven configuration (NMI, Ant Media, R2, Auth, WS). |

### Bootstrapping the first admin

```bash
# After first sign-in, promote yourself with the CLI:
npx tsx scripts/grant-admin.ts you@yourdomain.com super
```

Modes: `admin`, `super` (super_admin), `revoke` (viewer). After the first super_admin exists, promote others through `/admin/users/[id]` → Role dropdown.

### Audit log

Every privileged action writes a row to `audit_logs` via `logAudit(...)` in `src/lib/admin.ts`. Append-only; we never `update` or `delete` from app code.

## SEO & branding

The site is positioned as **"the Whatnot alternative for adult comics & cards"**. Metadata, OpenGraph, Twitter cards, and JSON-LD (Organization, WebSite, FAQ, NGO) all carry that line plus the **Divinity Comics Inc.** parent.

- Root metadata: `src/app/layout.tsx`
- About page (NGO JSON-LD, parent-entity verbiage): `src/app/about/page.tsx`
- FAQ schema for sellers: `src/app/sell/page.tsx`
- Per-show metadata (live status in title): `src/app/s/[id]/page.tsx`
- `robots.ts` allows public, disallows `/api/`, `/onboarding/`, `/account/`, `/orders/`, `/seller/`
- `sitemap.ts` lists home + `/sell` + `/about` + every legal page + every show

## What's not built yet

- Sign-up flow polish (avatar / hero image upload UI)
- Browser publishing edge cases (iOS Safari mic permission UX)
- Push notifications backend
- Moderation tools (chat ban actions, mute, content reporting UI — schema is ready)
- Search / categories / following feed UI (schema ready)
- Bulk lot import (CSV)

## Important notes

**Card data never touches our servers.** Card tokenization happens in the bidder's browser via PaymentCloud's CollectJS. We hold a vault id, not a card number. PCI scope = SAQ-A.

**Bank-account PII is encrypted at rest.** AES-256-GCM with a per-deployment 32-byte key. Plaintext never lives in the DB.

**CDN / host AUPs.** Cloudflare R2 + Cloudflare CDN are fine for adult per their AUPs. **Do NOT use Cloudflare Stream** — its AUP prohibits adult content.

## Development

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Prisma Studio: `npm run db:studio`
- Generate client: `npm run db:generate`
- Apply migrations in production: `npm run db:deploy`
