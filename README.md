# Indie Comics Live

> The Whatnot alternative for adult-friendly creators — live auctions for indie comics, NSFW art books, and trading cards.

Web-only PWA (no native apps, no app-store gatekeepers). High-risk-friendly payments via PaymentCloud, sub-second WebRTC streaming via self-hosted Ant Media. Built so adult-content creators don't get rugged by ToS changes.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19.2 + TS | RSC for show pages, route handlers for APIs |
| DB | PostgreSQL 17 + **Prisma 7.7** | Strict schema, transactional bids, generated types |
| Styling | Tailwind 4 (CSS-config) | |
| Auth | Auth.js v5 (Resend magic link) + `@auth/prisma-adapter` | No password storage |
| Live video | **Ant Media Server** (self-hosted, the user's `Anthill` fork) | Sub-second WebRTC, no NSFW AUP risk, no per-stream fees |
| Payments | **PaymentCloud / NMI** + CollectJS | High-risk-friendly; PAN tokenized in browser |
| Storage | Cloudflare R2 | Zero egress fees |
| Realtime | `ws` server (Node) + in-memory rooms | Auction state needs sub-second consistency |
| PWA | manifest + service worker | iOS web push works on installed PWAs (16.4+) |

**Hosting:** the WS server needs a long-running Node process — Vercel won't work for that. Deploy the Next app + WS server together on Fly.io / Railway / Render / a Hetzner box. Ant Media runs separately.

## Project layout

```
prisma/
  schema.prisma                       # User, Account, VerificationToken, Seller,
                                      # Show, Lot, Bid, Order, ChatMessage,
                                      # UserPaymentMethod, Follow
src/
  app/
    page.tsx                          # Home — SEO-targeted hero, live + scheduled
    sell/                             # Seller landing (FAQ JSON-LD, CTAs)
    s/[id]/                           # Watch page (Ant Media WebRTC + chat + bid bar)
    seller/                           # Seller dashboard
    seller/[id]/                      # Per-show: Broadcast tab + Lots manager
    account/payment-method/           # Save/replace card via CollectJS
    onboarding/handle/                # Force handle pick after sign-in
    orders/                           # Buyer's order list
    orders/[id]/                      # Single order: status + retry-charge button
    sign-in/                          # Magic-link sign-in
    sitemap.ts                        # Dynamic sitemap
    robots.ts                         # robots.txt allow public, disallow auth
    api/
      shows/                          # POST: create show (auto-issues publish URL/RTMP)
      shows/[id]/publish-token/       # GET: rotate Ant Media publish token
      shows/[id]/play-token/          # GET: short-lived play token
      lots/                           # POST: add lot
      lots/start/                     # POST: start next queued lot
      uploads/sign/                   # POST: signed R2 upload URL
      account/handle/                 # POST: pick / change handle
      payments/nmi/public-key/        # GET: CollectJS public key
      payment-methods/                # GET / POST: list, vault-and-save card
      orders/[id]/charge/             # POST: retry MIT charge
      webhooks/antmedia/              # liveStreamStarted / liveStreamEnded
      webhooks/nmi/                   # refund.success, chargeback.created
      auth/[...nextauth]/
  components/
    AntMediaPlayer.tsx                # WebRTC viewer (webrtc_adaptor.js)
    AntMediaPublisher.tsx             # Browser broadcaster (no OBS required)
    AgeGate.tsx                       # 18+ cookie gate (NOT real ID verification)
    PWARegister.tsx
    payments/
      NmiCardForm.tsx                 # CollectJS inline-iframe form
      use-collectjs-iframe-verify.ts  # Two-strike iframe-attach verifier
  lib/
    prisma.ts                         # PrismaClient singleton
    auction.ts                        # placeBid, startNextLot, closeLot ($transaction)
    antmedia.ts                       # JWT publish/play tokens, URLs, webhook verify
    nmi.ts                            # PaymentCloud Direct Post (vault, sale, refund...)
    payments.ts                       # chargeOrder (MIT vault charge on auction win)
    r2.ts                             # createSignedUpload
    onboarding.ts                     # requireOnboardedUser helper
    auth.ts                           # NextAuth + Resend + PrismaAdapter
    age-gate.ts
  server/
    ws.ts                             # WebSocket server: chat + bids + 1s lot tick
public/
  manifest.webmanifest
  sw.js
```

## Setup

1. Copy env template:
   ```bash
   cp .env.example .env.local
   ```

2. Install:
   ```bash
   npm install
   ```

3. Set up Prisma (PG17):
   ```bash
   npm run db:migrate    # creates the migration + applies in dev
   ```
   `npm run db:generate` runs automatically via `postinstall`.

4. Configure **Ant Media Server** (the `Anthill` fork):
   - In the panel: enable **JWT Stream Security Settings** → set the same secret as `ANT_MEDIA_JWT_SECRET`
   - Set **Stream Webhook URL** to `https://<host>/api/webhooks/antmedia` and the shared secret to `ANT_MEDIA_WEBHOOK_SECRET`

5. Configure **PaymentCloud / NMI**:
   - From the merchant portal: copy the security key → `NMI_SECURITY_KEY`
   - Get the CollectJS public tokenization key → `NMI_PUBLIC_KEY`
   - Configure webhooks → `https://<host>/api/webhooks/nmi`, secret → `NMI_WEBHOOK_SECRET`

6. Run app + WS server:
   ```bash
   npm run dev:all
   ```

## Auction engine

`src/lib/auction.ts`:
- `placeBid` — Prisma `$transaction` with raw `SELECT ... FOR UPDATE` on the lot row. Validates lot is live, hasn't expired, bid >= current + min increment, bidder isn't already the high bidder. **Anti-snipe**: a bid in the last `softCloseSeconds` extends `endsAt`.
- `startNextLot` — flips the next queued lot to `live` and sets `endsAt = now + duration`.
- `closeLot` — called by the WS server's 1-second tick. Marks `sold` (creates order, returns orderId) or `unsold`.

`src/lib/payments.ts`:
- `chargeOrder` — loads order + default vaulted card, calls `saleByVaultToken` with NMI's CIT/MIT credential-on-file flags. First charge tags `stored_credential_indicator="stored"` and records `initialTransactionId`; subsequent charges send `"used"` + the original txn id, which is what PaymentCloud/NMI wants for clean interchange.

The WS server invokes `chargeOrder` async after `closeLot` and broadcasts an `order_charged` event with the result.

## Payment flow

```
1. Bidder signs in → /onboarding/handle (one-time) → /account/payment-method
   ↓
2. NmiCardForm tokenizes card via CollectJS (PAN never leaves browser)
   ↓
3. POST /api/payment-methods
   ↓ NMI: customer_vault add_customer  → vault_id
   ↓ NMI: type=validate (auth-and-void) → confirms card is real
   ↓ INSERT user_payment_methods, mark default
   ↓
4. Bidder wins auction → ws server `closeLot` → order created
   ↓
5. ws server fires chargeOrder()
   ↓ NMI: type=sale + customer_vault_id + MIT flags
   ↓ on first sale, store transactionid as initialTransactionId
   ↓ broadcast {type: "order_charged", ok: true | false}
   ↓
6. Buyer sees status on /orders/[id]; retry button if declined
```

## SEO & branding

The site is positioned as **"the Whatnot alternative for adult comics & cards"**. Metadata, OpenGraph, Twitter cards, and JSON-LD (Organization, WebSite, FAQ) all carry that line.

- Root metadata: `src/app/layout.tsx`
- FAQ schema for sellers: `src/app/sell/page.tsx`
- Per-show metadata (live status in title): `src/app/s/[id]/page.tsx`
- `robots.ts` allows public, disallows `/api/`, `/onboarding/`, `/account/`, `/orders/`, `/seller/`
- `sitemap.ts` lists home + `/sell` + every show

## What's not built yet

- Real ID-based age verification (deliberately deferred — see note below)
- Sign-up flow polish (no avatar upload UI)
- Seller approval workflow + KYC
- Browser publishing edge cases (iOS Safari mic permission UX)
- Push notifications backend
- Moderation tools (chat ban, mute, content reporting)
- Search / categories / following feed
- Bulk lot import (CSV)

## Important notes

**Age verification:** the cookie 18+ gate is a soft check only. Real ID verification was intentionally not implemented. Several US states (TX, LA, UT, VA, ...) and the UK now require ID verification for adult sites. **Do this before launching publicly.** The schema has space for it (add it later) but no code is wired up.

**CDN / host AUPs:** Cloudflare R2 + Cloudflare CDN are fine for adult content per their AUPs. **Do NOT use Cloudflare Stream** — its AUP prohibits adult content. Mux and AWS IVS would also need explicit AUP review; we sidestep that by self-hosting Ant Media.

## Development

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Prisma Studio: `npm run db:studio`
- Generate client: `npm run db:generate`
- Apply migrations in production: `npm run db:deploy`
