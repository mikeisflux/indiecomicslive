# indiecomicslive

Web-based live-auction platform for independent comics, modeled on Whatnot. PWA-first (installable on iOS/Android), no native apps. Built around adult content from day one — high-risk payment processing via PaymentCloud, self-hosted streaming via Ant Media.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19.2 + TypeScript | RSC for show pages, route handlers for APIs |
| DB | PostgreSQL 17 + Drizzle ORM 0.45 | Strict schema, transactional bids |
| Styling | Tailwind 4 (CSS-config) | |
| Auth | Auth.js v5 (Resend magic link) | No password storage |
| Live video | **Ant Media Server** (self-hosted) | Sub-second WebRTC, no NSFW AUP risk, no per-stream fees |
| Payments | **PaymentCloud / NMI** + CollectJS | High-risk-friendly; PAN tokenized in browser |
| Storage | Cloudflare R2 | Zero egress fees for VOD/images |
| Realtime | `ws` server (Node) + in-memory rooms | Auction state needs sub-second consistency |
| PWA | manifest + service worker | iOS web push works on installed PWAs (16.4+) |

**Hosting note:** the WS server needs a long-running Node process — Vercel won't work. Deploy the Next app and the WS server together on Fly.io, Railway, Render, or a dedicated box. The Ant Media server runs separately (it's the user's `Anthill` fork).

## Project layout

```
src/
  app/
    page.tsx                            # Home (live + scheduled)
    s/[id]/                             # Watch page (Ant Media WebRTC + chat + bid bar)
    seller/                             # Dashboard
    seller/[id]/                        # Per-show: Broadcast tab (browser publisher) + Lots
    account/payment-method/             # Save / replace card (CollectJS)
    sign-in/
    api/
      shows/                            # POST: create show (auto-issues publish URL/RTMP)
      shows/[id]/publish-token/         # GET: re-issue Ant Media publish token
      shows/[id]/play-token/            # GET: short-lived play token
      lots/                             # POST: add lot
      lots/start/                       # POST: start next queued lot
      uploads/sign/                     # POST: signed R2 upload URL
      payments/nmi/public-key/          # GET: CollectJS public key
      payment-methods/                  # GET / POST: list, vault-and-save card
      orders/[id]/charge/               # POST: retry MIT charge
      webhooks/antmedia/                # liveStreamStarted / liveStreamEnded
      auth/[...nextauth]/
  components/
    AntMediaPlayer.tsx                  # WebRTC <-> webrtc_adaptor.js
    AntMediaPublisher.tsx               # Browser broadcaster
    AgeGate.tsx                         # Cookie-based 18+ gate (NOT real ID verification)
    PWARegister.tsx
    payments/
      NmiCardForm.tsx                   # CollectJS inline-iframe form
      use-collectjs-iframe-verify.ts    # Two-strike iframe-attach verifier
  db/
    schema.ts                           # Drizzle: users, sellers, shows, lots, bids,
                                        # orders, userPaymentMethods, chatMessages,
                                        # ageVerifications, follows
    index.ts
  lib/
    auction.ts                          # placeBid, startNextLot, closeLot (transactional)
    antmedia.ts                         # JWT signing, publish/play URLs, webhook verify
    nmi.ts                              # PaymentCloud Direct Post (vault, sale, refund...)
    payments.ts                         # chargeOrder (MIT vault charge on auction win)
    r2.ts                               # createSignedUpload
    auth.ts
    age-gate.ts
  server/
    ws.ts                               # WebSocket server: chat + bids + 1s lot tick
public/
  manifest.webmanifest
  sw.js
drizzle/                                # generated migrations
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

3. Push schema to Postgres (PG17):
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Configure **Ant Media Server**:
   - In the panel, enable "JWT Stream Security Settings" → set the same secret as `ANT_MEDIA_JWT_SECRET`
   - Set "Stream Webhook URL" to `https://<your-host>/api/webhooks/antmedia` and the shared secret to `ANT_MEDIA_WEBHOOK_SECRET`

5. Configure **PaymentCloud / NMI**:
   - From the merchant portal, copy the security key → `NMI_SECURITY_KEY`
   - Get the CollectJS public tokenization key → `NMI_PUBLIC_KEY`
   - The default gateway URL is PaymentCloud's NMI white-label host. Override with `NMI_GATEWAY_URL` only if your reseller proxies elsewhere.

6. Run app + WS server:
   ```bash
   npm run dev:all
   ```

## Auction engine

`src/lib/auction.ts`:
- `placeBid` — Postgres transaction with `SELECT ... FOR UPDATE`. Validates lot is live, hasn't expired, bid >= current + min increment, bidder isn't already the high bidder. **Anti-snipe**: bid in the last `softCloseSeconds` extends `endsAt`.
- `startNextLot` — flips next queued lot to `live` and sets `endsAt = now + duration`.
- `closeLot` — called by the WS server's 1-second tick. Marks `sold` (creates order, returns orderId for charge) or `unsold`.

`src/lib/payments.ts`:
- `chargeOrder` — loads order + default vaulted card, calls `saleByVaultToken` with NMI's CIT/MIT credential-on-file flags. First charge tags `stored_credential_indicator="stored"`; subsequent charges use `"used"` + `initial_transaction_id`.

The WS server invokes `chargeOrder` async after `closeLot` and broadcasts an `order_charged` event with the result.

## Payment flow

```
1. Bidder signs in → /account/payment-method
   ↓
2. NmiCardForm tokenizes card via CollectJS (PAN never leaves browser)
   ↓
3. POST /api/payment-methods
   ↓ NMI: customer_vault add_customer  → vault_id
   ↓ NMI: type=validate (auth-and-void) → confirms card is real
   ↓ insert userPaymentMethods row, mark default
   ↓
4. Bidder wins auction → ws server `closeLot` → order created
   ↓
5. ws server fires chargeOrder()
   ↓ NMI: type=sale + customer_vault_id + MIT flags
   ↓ on first sale, store transactionid as initialTransactionId
   ↓ broadcast {type: "order_charged", ok: true | false}
```

## NSFW-specific decisions still open

- **Age verification**: the cookie age gate is a soft check only. Real bidding must be gated by Persona / Yoti / AgeID. Schema has `ageVerifications` table ready.
- **CDN/host**: Cloudflare R2 + Cloudflare CDN are fine for adult per their AUPs. **Do not use Cloudflare Stream** — its AUP prohibits adult content.
- **Webhook coverage**: Ant Media's webhook surface is limited. Use `getBroadcastStatus` polling in addition to webhooks for status changes during dev.

## What's not built yet

- Actual sign-up flow / handle picker
- Seller approval workflow
- Per-show seller console: lot creation form + image upload + start/end controls (skeleton only)
- Real ID-based age verification
- Order/checkout summary page (charge succeeds in background; no buyer confirmation page)
- Shipping label / tracking integration
- Push notifications backend
- Moderation tools (chat ban, mute, content reporting)
- Search / categories / following feed

## Development

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- DB studio: `npm run db:studio`

## A note on `Anthill`

`Anthill` is the user's fork of [Ant Media Server](https://antmedia.io/) (the Java/Maven streaming server). This Next.js app talks to it over WebSocket (publish/play) and HTTP (REST + webhooks). Recordings can be pushed straight to R2 via Ant Media's S3 recording feature.
