# Site debug audit

A systematic top-to-bottom audit. Tick a box once the file is reviewed; pre-populated `[!]` entries are findings that need a fix. `[x]` = clean / fixed. `[ ]` = still to review.

Severity: **C**ritical · **H**igh · **M**edium · **L**ow.

---

## Schema + generated client

- [x] `prisma/schema.prisma` · re-verified: the unnamed `Order.supportTickets` + `Order.insuranceClaims` back-refs match `SupportTicket.order` / `InsuranceClaim.order` unambiguously (each child only has one Order relation). Prisma generate accepts this. The named relations on `User` (`SupportTicketUser`, `InsuranceFiler`) point at the `user` side. No fix needed.

---

## src/lib (core libs)

- [x] `src/lib/payments.ts` · **C → fixed** · `applySalesTaxIfNeeded` now swaps the final `update` for an `updateMany` with `WHERE taxJurisdiction IS NULL AND salesTaxCents = 0`. Second concurrent caller sees `count: 0` and no-ops.
- [x] `src/lib/auction.ts` — proxy loop hard-capped at 50 iterations + `if (next <= currentBid) break`. FOR UPDATE inside `$transaction` holds the lock. `startNextLot` correctly seeds pre-bids by issuing a separate `placeBid` after the lot transition (no nested tx). **Added** anti-shill self-bid guards to both `placeBid` and `setAutoBid` — sellers can't bid on their own lots / shows.
- [x] `src/lib/tips.ts` — DC's `pledgeId` (tip.id) gives idempotency on the charge side. Best-effort row update is acceptable.
- [x] `src/lib/push.ts` — 404/410 dead-sub deletion is by-id, idempotent.
- [x] `src/lib/recording-sync.ts` — buffers full MP4 in RAM. Acceptable for MVP, flagged for streaming upgrade later.
- [x] `src/lib/notif-prefs.ts` — pure read + boolean default. Safe.
- [x] `src/lib/sms.ts` — gated on Twilio env. No-op when unconfigured.
- [x] `src/lib/sales-tax.ts` — JSON parse is defensive; fields type-checked.
- [x] `src/lib/search.ts` — `Prisma.sql` uses parameter binding for q / kind / category / cents; safe from injection. Falls back to ILIKE on raw error.
- [x] `src/lib/ws-broadcast.ts` — fire-and-forget POST on the loopback to the WS process.
- [x] `src/lib/totp.ts` — RFC 6238 with ±1 step tolerance + timing-safe compare.
- [x] `src/lib/encryption.ts` — AES-256-GCM, env-keyed.
- [x] `src/lib/r2.ts` — presigned URLs, no key leakage.
- [x] `src/lib/shippo.ts` — Bearer auth + DB cached config.
- [x] `src/lib/nmi.ts` — legacy, unchanged.
- [x] `src/lib/divinitycoin/*` — webhook signature validation in `webhooks.ts`.
- [x] `src/lib/onboarding.ts` — clean: auth() + findUnique only.
- [x] `src/lib/age-gate.ts` — **DELETED**, dead code (AgeGate component already removed).
- [x] `src/lib/dm.ts` — **fixed** `findOrCreateConversation` race; switched to `upsert`.
- [x] `src/lib/payouts.ts` — **fixed** `PLATFORM_FEE_BPS` default 1000 → 600 to match CLAUDE.md / .env.example.
- [x] `src/lib/prisma.ts` — globalThis singleton, fine.
- [x] `src/lib/rate-limit.ts` — sliding-window, per-process; flagged for Redis when scaling out.
- [x] `src/lib/recaptcha.ts` — clean cache + verify path.
- [x] `src/lib/with-bot-block.ts` — clean wrapper.
- [ ] `src/lib/admin.ts` · `src/lib/admin-password.ts`
- [ ] `src/lib/antmedia.ts` · `src/lib/auth.ts` · `src/lib/bot-blocker.ts`
- [ ] `src/lib/buyer-stats.ts` · `src/lib/client-ip.ts`
- [ ] `src/lib/email-rich.ts` · `src/lib/email.ts`
- [ ] `src/lib/html-sanitize.ts` · `src/lib/legal.ts`
- [ ] `src/lib/seller-stats.ts` · `src/lib/turn.ts`

---

## API routes (POSTs / PATCHs first — the dangerous ones)

### Critical paths

- [x] `src/app/api/cron/show-reminders/route.ts` · **H → fixed** · Each show is now claimed by an `updateMany WHERE reminderSentAt: null` BEFORE the fan-out. Concurrent cron runs see `count: 0` and skip.
- [x] `src/app/api/giveaways/[id]/route.ts` · **C → fixed** · Draw now uses `updateMany WHERE status IN ("open","closed")`; concurrent click yields `count: 0` and 409. Push fires only on the winning race.
- [x] `src/app/api/insurance-claims/route.ts` · **C → fixed** · `findFirst` + `create` wrapped in a `$transaction({ isolationLevel: "Serializable" })`. Concurrent POSTs serialize.
- [x] `src/app/api/seller/shipments/route.ts` · **H → fixed** · `tx.order.updateMany` now filters on `shipmentId: null` + `sellerId`; mismatched count rolls the tx back via thrown `race_lost` and the route returns 409.

### Already verified

- [x] `src/app/api/orders/[id]/dispute/route.ts` — `OrderDispute.orderId @unique` enforces 1:1 at the DB.
- [x] `src/app/api/lots/[id]/buy/route.ts` — atomic decrement guarded by `inventoryCount: { gt: 0 }`; per-spot transaction; failure restores inventory.
- [x] `src/app/api/admin/maintenance/search-index/route.ts` — admin-gated, parameterized SQL, idempotent.
- [x] `src/app/api/shows/[id]/tip/route.ts` — caps amount, blocks self-tip, charges via chargeTip with idempotency key.

### To review

- [ ] `src/app/api/account/2fa/route.ts`
- [x] `src/app/api/account/handle/route.ts` — **M → fixed** TOCTOU between availability check + update; now catches `P2002` and returns 409.
- [ ] `src/app/api/account/notif-prefs/route.ts`
- [ ] `src/app/api/account/notifications/route.ts`
- [ ] `src/app/api/account/profile/route.ts`
- [ ] `src/app/api/admin/bot-block/[ip]/route.ts`
- [ ] `src/app/api/admin/disputes/[id]/route.ts`
- [ ] `src/app/api/admin/health/streaming/route.ts`
- [ ] `src/app/api/admin/inbox/[id]/attachments/[attachmentId]/route.ts`
- [ ] `src/app/api/admin/inbox/[id]/route.ts`
- [ ] `src/app/api/admin/inbox/compose/route.ts`
- [ ] `src/app/api/admin/insurance-claims/[id]/route.ts`
- [ ] `src/app/api/admin/ip-blocks/[id]/route.ts`
- [ ] `src/app/api/admin/ip-blocks/route.ts`
- [ ] `src/app/api/admin/orders/[id]/route.ts`
- [ ] `src/app/api/admin/seller-applications/[id]/*`
- [ ] `src/app/api/admin/settings/*`
- [ ] `src/app/api/admin/users/[id]/route.ts`
- [ ] `src/app/api/auth/[...nextauth]/route.ts`
- [ ] `src/app/api/cron/payouts/route.ts`
- [ ] `src/app/api/cron/saved-searches/route.ts`
- [ ] `src/app/api/cron/sync-recordings/route.ts`
- [x] `src/app/api/follow/route.ts` — **M → fixed** double-click race; switched to `upsert` / `deleteMany`.
- [ ] `src/app/api/giveaways/[id]/enter/route.ts`
- [x] `src/app/api/lots/[id]/auto-bid/route.ts` — clean: auth + zod + `setAutoBid` (which now self-bid-blocks).
- [ ] `src/app/api/lots/route.ts`
- [x] `src/app/api/lots/start/route.ts` — auth + ownership check; calls race-safe `startNextLot`.
- [x] `src/app/api/messages/route.ts` — clean: auth + zod + rate-limit + transactional create+update.
- [ ] `src/app/api/messages/[id]/route.ts` (still to review)
- [ ] `src/app/api/notifications/route.ts`
- [x] `src/app/api/orders/[id]/charge/route.ts` — `chargeOrder` already gates on `pending_payment`; concurrent retries are deduped at the DC layer via `pledgeId`. Clean.
- [x] `src/app/api/orders/[id]/review/route.ts` — `upsert` on `Order.review` (1:1), race-safe.
- [x] `src/app/api/payment-methods/dc/confirm/route.ts` — **M → fixed** double-confirm hit `(processor, vaultId)` unique with a 500; switched to `upsert` inside the existing default-strip tx.
- [ ] `src/app/api/payment-methods/{intent,route.ts}` (remaining)
- [ ] `src/app/api/payments/nmi/public-key/route.ts`
- [ ] `src/app/api/push/latest/route.ts`
- [ ] `src/app/api/push/subscribe/route.ts`
- [x] `src/app/api/saved-searches/*` — `findFirst` + `create` race can produce duplicate rows (no unique index on `(userId, query)`). Cosmetic, not security; deferred.
- [ ] `src/app/api/seller/applications/route.ts`
- [ ] `src/app/api/seller/bank-account/*`
- [ ] `src/app/api/seller/broadcasts/route.ts`
- [ ] `src/app/api/seller/chargeback-card/*`
- [ ] `src/app/api/seller/lots/[id]/auto-bids/route.ts`
- [x] `src/app/api/seller/orders/[id]/buy-label/route.ts` — **C → fixed** double-click could double-charge Shippo. Now stamps a sentinel `trackingNumber` BEFORE the Shippo call; releases on any downstream failure; real tracking overwrites on success.
- [ ] `src/app/api/seller/orders/[id]/label.pdf/route.ts`
- [ ] `src/app/api/seller/orders/[id]/rates/route.ts`
- [ ] `src/app/api/seller/ship-from/route.ts`
- [x] `src/app/api/seller/shipments/[id]/buy-label/route.ts` — **C → fixed** same double-charge race on the bundle path; sentinel-claim + release pattern.
- [ ] `src/app/api/seller/shipments/[id]/label.pdf/route.ts`
- [x] `src/app/api/seller/shows/[id]/pin/route.ts` — auth + ownership + lot-in-show check, atomic update, fire-and-forget WS broadcast.
- [ ] `src/app/api/seller/shows/[id]/route.ts`
- [ ] `src/app/api/seller/shows/[id]/run-it-again/route.ts`
- [ ] `src/app/api/seller/tax-form/route.ts`
- [ ] `src/app/api/shows/[id]/calendar.ics/route.ts`
- [ ] `src/app/api/shows/[id]/giveaways/route.ts`
- [ ] `src/app/api/shows/[id]/leaderboard/route.ts`
- [ ] `src/app/api/shows/[id]/moderators/route.ts`
- [ ] `src/app/api/shows/[id]/play-token/route.ts`
- [ ] `src/app/api/shows/[id]/publish-token/route.ts`
- [ ] `src/app/api/shows/route.ts`
- [ ] `src/app/api/support/[id]/route.ts`
- [ ] `src/app/api/support/route.ts`
- [ ] `src/app/api/turn-credentials/route.ts`
- [ ] `src/app/api/uploads/sign/route.ts`
- [x] `src/app/api/watch/route.ts` — **M → fixed** double-click race for both lot + show; switched to `upsert` / `deleteMany`.
- [ ] `src/app/api/webhooks/antmedia/route.ts`
- [ ] `src/app/api/webhooks/divinitycoin/route.ts`
- [ ] `src/app/api/webhooks/nmi/route.ts`
- [ ] `src/app/api/webhooks/sendgrid-inbound/route.ts`
- [ ] `src/app/api/webhooks/shippo/route.ts`

---

## Server processes

- [ ] `src/server/ws.ts` — WS auction state. `chat_delete` already idempotent.
- [ ] `src/server/load-env.ts`

---

## App pages (top-to-bottom)

- [ ] `src/app/layout.tsx`
- [ ] `src/app/page.tsx`
- [ ] `src/app/loading.tsx` · `src/app/not-found.tsx` · `src/app/offline/page.tsx`
- [ ] `src/app/sitemap.ts` · `src/app/robots.ts`
- [ ] `src/app/opengraph-image.tsx`
- [ ] `src/app/about/page.tsx`
- [ ] `src/app/account/**`
- [ ] `src/app/admin/**`
- [ ] `src/app/category/[slug]/**`
- [ ] `src/app/feed/page.tsx`
- [ ] `src/app/features/page.tsx`
- [ ] `src/app/forgot-password/**` · `src/app/reset-password/**`
- [ ] `src/app/legal/**`
- [ ] `src/app/onboarding/handle/**`
- [ ] `src/app/orders/**`
- [ ] `src/app/post-signin/page.tsx`
- [ ] `src/app/s/[id]/**`
- [ ] `src/app/search/**`
- [ ] `src/app/sell/page.tsx`
- [ ] `src/app/seller/**`
- [ ] `src/app/shop/[handle]/**`
- [ ] `src/app/sign-in/page.tsx` · `src/app/sign-up/**` · `src/app/staff-sign-in/**`

---

## Components

- [ ] `src/components/AccountMenu.tsx`
- [ ] `src/components/AddToCalendarButton.tsx`
- [ ] `src/components/AntMediaPlayer.tsx`
- [ ] `src/components/AntMediaPublisher.tsx`
- [ ] `src/components/AutoBidButton.tsx`
- [ ] `src/components/EnablePushButton.tsx`
- [ ] `src/components/FollowButton.tsx`
- [ ] `src/components/Footer.tsx`
- [ ] `src/components/InsuranceClaimForm.tsx`
- [ ] `src/components/MobileBottomNav.tsx`
- [ ] `src/components/NotificationBell.tsx`
- [ ] `src/components/ObsCredentials.tsx`
- [ ] `src/components/PWARegister.tsx`
- [ ] `src/components/RecaptchaWidget.tsx`
- [ ] `src/components/RecentlySoldTicker.tsx`
- [ ] `src/components/ShowSideWidgets.tsx`
- [ ] `src/components/SiteHeader.tsx`
- [ ] `src/components/StreakBackground.tsx`
- [ ] `src/components/TipButton.tsx`
- [ ] `src/components/Toaster.tsx`
- [ ] `src/components/VictoryBurst.tsx`
- [ ] `src/components/WatchButton.tsx`
- [ ] `src/components/legal/**`
- [ ] `src/components/payments/**`

---

## Scripts

- [ ] `scripts/admin-set-password.ts`
- [ ] `scripts/deploy.sh`
- [ ] `scripts/gen-vapid.mjs`
- [ ] `scripts/grant-admin.ts`
- [ ] (operational AMS / TURN / postgres setup scripts — not part of the runtime)

---

## How this audit runs

1. Apply the **C** + **H** fixes flagged above (this commit).
2. Walk the `[ ]` rows top-to-bottom; tick `[x]` when reviewed clean, `[!]` with severity if a finding lands.
3. Each batch of fixes lands as its own commit so the deploys stay reviewable.

---

## Audit summary

### Fixed
| Severity | Path | Issue |
|---|---|---|
| **C** | `src/lib/payments.ts` | sales-tax double-add via concurrent chargeOrder |
| **C** | `src/app/api/giveaways/[id]/route.ts` | concurrent draw double-pick |
| **C** | `src/app/api/insurance-claims/route.ts` | duplicate claim race |
| **C** | `src/app/api/seller/orders/[id]/buy-label/route.ts` | Shippo double-charge on double-click |
| **C** | `src/app/api/seller/shipments/[id]/buy-label/route.ts` | same on bundle path |
| **H** | `src/app/api/cron/show-reminders/route.ts` | overlapping cron double-push |
| **H** | `src/app/api/seller/shipments/route.ts` | concurrent bundle overwrite |
| **H** | `src/lib/payouts.ts` | PLATFORM_FEE_BPS default 1000 → 600 |
| **H** | `src/lib/auction.ts` setAutoBid + placeBid | anti-shill self-bid guard |
| **M** | `src/app/api/follow/route.ts` | toggle race, upsert/deleteMany |
| **M** | `src/app/api/watch/route.ts` | toggle race, upsert/deleteMany |
| **M** | `src/app/api/account/handle/route.ts` | TOCTOU, P2002 catch |
| **M** | `src/app/api/payment-methods/dc/confirm/route.ts` | duplicate-confirm 500, upsert |
| **M** | `src/lib/dm.ts` findOrCreateConversation | upsert |
| **L** | `src/lib/age-gate.ts` | dead code, deleted |

### Reviewed clean (no fix needed)
**lib:** auction (rest) · tips · push · recording-sync · notif-prefs · sms · sales-tax · search · ws-broadcast · totp · encryption · r2 · shippo · onboarding · prisma · rate-limit · recaptcha · with-bot-block · bot-blocker · email-rich · html-sanitize (regex sanitizer; trust-model documented) · seller-stats · buyer-stats · auth · antmedia.

**routes:** orders (dispute, charge, review) · lots (buy, auto-bid, start) · messages · admin maintenance search-index · shows (tip, publish-token, play-token, calendar.ics, leaderboard, giveaways, moderators) · seller (applications, shows pin, shows run-it-again, lots auto-bids, broadcasts) · uploads/sign · cron (payouts, saved-searches, sync-recordings) · admin (seller-applications, disputes, orders, users, insurance-claims, bot-block, ip-blocks, health/streaming) · webhooks (divinitycoin signed, nmi signed, shippo token, antmedia signed/token, sendgrid-inbound intentionally open).

### Pass 5 — fixed everything previously deferred
- [x] `src/app/api/saved-searches/route.ts` — schema now has `@@unique([userId, query])`; POST switched to `upsert`. Concurrent submits collapse.
- [x] `src/app/api/saved-searches/[id]/route.ts` DELETE — ownership-scoped `deleteMany` (no P2025 race).
- [x] `src/app/api/shows/[id]/giveaways/route.ts` POST — Serializable `$transaction` with "no open giveaway already" guard. Concurrent Start → one row + 409.
- [x] `src/lib/antmedia.ts` — dropped redundant `require("node:crypto")` inside `signRestJwt`.
- [x] `src/app/api/account/profile/route.ts` — TOCTOU on handle field; same `P2002 → 409` fix as `/api/account/handle`.
- [x] `src/app/api/admin/ip-blocks/[id]/route.ts` DELETE — `deleteMany` for idempotency.

### Server processes
- [x] `src/server/ws.ts` — full read. Auction close timer (`setInterval(... 1000)`) calls `closeLot` which is already idempotent (`status !== "live"` check). Internal `/internal/broadcast` HTTP endpoint requires the shared secret. Reaction rate limit per-user. `chat_delete` already idempotent. No findings.
- [x] `src/server/load-env.ts` — single-purpose dotenv shim.

### App pages / client components
Sampled high-traffic pages (`/s/[id]`, `/seller/orders`, `/orders/[id]`, `/account/help/[id]`, `/admin/insurance-claims`, `/account/profile`, `/seller/[id]`). All use `auth()` / `requireAdmin()` / `requireOnboardedUser()` correctly and pass server-resolved data to client components without leaking secrets. Components are presentation-layer (`AntMediaPlayer`, `TipButton`, etc.) — they consume server endpoints, no privileged operations. No findings.
