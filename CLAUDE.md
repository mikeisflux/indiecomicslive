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

We run the app under **pm2**, not systemd. The `scripts/deploy.sh` in this repo still references `systemctl` — that script is stale; use pm2 for restarts. Typical commands:

```bash
pm2 list
pm2 restart indiecomicslive
pm2 restart indiecomicslive-ws
pm2 logs indiecomicslive --lines 200
pm2 logs indiecomicslive-ws --lines 200
```

Do **not** run `sudo systemctl restart indiecomicslive*` — that's the old setup.

## Payment processors

We have two processors in the codebase. The branding distinction is critical:

| Context                   | Use this name              | Don't use                   |
| ------------------------- | -------------------------- | --------------------------- |
| Internal code, env vars, lib paths, module names, admin UI, webhook routes | `DivinityCoin` / `divinitycoin` / `dc` | — |
| Public-facing legal docs, marketing copy, About page, /sell page, FAQ, emails | **`Divinity Payments`** | `DivinityCoin`, `divinitycoin`, `divinity coin` |

**Never expose `DivinityCoin` / `divinitycoin` to users.** The public brand is **Divinity Payments**.

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

## Pending / planned work

- **ShipStation integration** — per-seller. Sellers ship their own items; we need to wire each approved seller to ShipStation so they can buy + print labels and we can pull tracking back into the order record. Not started yet.

## Conventions

- TypeScript strict mode is on. Don't add `any` casually.
- No tests exist yet — verify changes by typecheck (`npx tsc --noEmit`) and `npm run build`.
- Don't add backward-compat shims unless asked.
- Keep comments scarce; prefer self-explanatory code.
