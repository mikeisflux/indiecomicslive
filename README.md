# indiecomicslive

Web-based live-auction platform for independent comics, modeled on Whatnot. PWA-first (installable on iOS/Android), no native apps. Built around adult content from day one — assumes high-risk payment processing and ID-based age verification.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | RSC for show pages, route handlers for APIs |
| DB | Postgres + Drizzle ORM | Strict schema, transactional bids |
| Auth | Auth.js v5 (Resend magic link) | No password storage |
| Live video | Mux | Existing account; allows adult content per AUP review |
| Storage | Cloudflare R2 | Zero egress fees for VOD/images |
| Realtime | `ws` server (Node, in-memory rooms) | Auction state needs sub-second consistency |
| Styling | Tailwind | |
| PWA | manifest + service worker | iOS web push works on installed PWAs (16.4+) |

**Hosting note:** the WS server needs a long-running Node process. Vercel won't work for that. Deploy the Next app and the WS server together on Fly.io / Railway / Render / a Hetzner box.

## Project layout

```
src/
  app/                      # Next.js routes
    page.tsx                # Home (live + scheduled shows)
    s/[id]/                 # Watch page (Mux Player + chat + bid bar)
    seller/                 # Seller dashboard (create show -> RTMP key)
    sign-in/
    api/
      shows/                # POST: create show + Mux live stream
      lots/                 # POST: add a lot
      lots/start/           # POST: start the next queued lot
      uploads/sign/         # POST: signed R2 upload URL
      webhooks/mux/         # Mux events: live stream went active/idle
      auth/[...nextauth]/
  components/
    AgeGate.tsx             # Cookie-based 18+ gate (NOT real ID verification)
    PWARegister.tsx
  db/
    schema.ts               # Drizzle: users, shows, lots, bids, orders, ...
    index.ts
  lib/
    auction.ts              # placeBid, startNextLot, closeLot (transactional)
    mux.ts                  # createLiveStream, webhook signature verify
    r2.ts                   # createSignedUpload
    auth.ts
    age-gate.ts
  server/
    ws.ts                   # WebSocket server: chat + bids + lot timers
public/
  manifest.webmanifest
  sw.js
drizzle/                    # generated migrations
```

## Setup

1. Copy env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
2. Install:
   ```bash
   npm install
   ```
3. Push schema to Postgres:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
4. Run app + WS server together:
   ```bash
   npm run dev:all
   ```
   Or separately: `npm run dev` and `npm run ws`.

5. Configure Mux webhook to `https://<your-host>/api/webhooks/mux` with `MUX_WEBHOOK_SECRET`.

## Auction engine

The interesting bits live in `src/lib/auction.ts`:

- `placeBid` runs in a Postgres transaction with `SELECT ... FOR UPDATE` on the lot row. Validates: lot is live, hasn't expired, bid >= current + min increment, bidder isn't already the high bidder. Implements **anti-snipe** (soft close): a bid in the last `softCloseSeconds` extends `endsAt`.
- `startNextLot` flips the next queued lot to `live` and sets `endsAt = now + duration`.
- `closeLot` is called by the WS server's 1-second tick when `endsAt` passes — marks `sold` (and creates an order) or `unsold`.

The WS server holds room membership in memory. Each show is a room. Single-process for MVP. To scale horizontally, swap the in-memory `rooms` map for Redis pub/sub or move per-room state into Cloudflare Durable Objects.

## NSFW-specific decisions still open

These are intentionally not implemented yet — they need accounts/contracts before code matters.

- **Payments**: Stripe/PayPal/Square all prohibit adult content. Need CCBill, Segpay, Verotel, or Epoch. Order rows have `paymentProvider` + `paymentRef` placeholders.
- **Age verification**: the cookie age gate is a soft check only. Real bidding must be gated by Persona / Yoti / AgeID. Schema has `ageVerifications` table ready.
- **Mux AUP**: confirm in writing that Mux allows your content category before launch.
- **CDN/host**: Cloudflare R2 + Cloudflare CDN are fine for adult per their AUPs (read carefully). **Do not use Cloudflare Stream** — its AUP prohibits adult content.

## What's not built yet

- Actual sign-up flow / handle picker
- Seller approval workflow
- Per-show seller console (start lot, end lot, manage queue)
- Browser-based broadcasting (assumes OBS → RTMP for now)
- Order/checkout (blocked on payment processor)
- Shipping / tracking
- Push notifications (PWA hook is wired, no backend yet)
- Moderation tools (chat ban, mute, content reporting)
- Search / categories / following feed

## Development

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- DB studio: `npm run db:studio`
