import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Features — Indie Comics Live",
  description:
    "Every feature on Indie Comics Live, side-by-side with Whatnot. Sub-second WebRTC bidding, auto-bid, giveaways, mobile go-live, recordings, broadcast-to-followers, web push, and more.",
  alternates: { canonical: "/features" },
};

const SECTIONS: {
  title: string;
  blurb: string;
  items: { name: string; detail: string }[];
}[] = [
  {
    title: "Live show experience",
    blurb: "Sub-second WebRTC, sniping protection, real-time chat with moderators, and replay with chapter jumps.",
    items: [
      { name: "WebRTC bidding (sub-second)", detail: "No HLS-only delay; bid lands before the next breath." },
      { name: "Soft-close anti-snipe", detail: "Auctions extend automatically when a bid lands inside the closing window." },
      { name: "Auto-bid (max-bid proxy)", detail: "Set your ceiling once; the engine bumps you in step with min-increments." },
      { name: "Pre-bid before live", detail: "Place a max bid on a queued lot — fires the moment the seller opens it." },
      { name: "Flash auctions", detail: "Lightning-mode short timers for high-velocity drops." },
      { name: "Pack breaks (with per-spot UI)", detail: "Sell N spots from one pack; each spot becomes its own order." },
      { name: "Mystery boxes", detail: "Hidden contents revealed on purchase, with rich-text reveal." },
      { name: "Giveaways + auto-draw", detail: "Open a giveaway, viewers tap Enter, host clicks Draw — push to the winner." },
      { name: "Top-buyer leaderboard", detail: "Real-time top spenders panel per show." },
      { name: "Run-it-again", detail: "One-tap clone of the last sold lot back into the queue." },
      { name: "Co-host moderators", detail: "Deputize trusted viewers to delete spam and run giveaways." },
      { name: "Floating reactions + haptics", detail: "Hearts, fire, money, comic — vibrate on tap on mobile." },
      { name: "Chat overlay on video", detail: "Optional translucent chat pinned to the lower 1/3." },
      { name: "Show recordings + R2 archive", detail: "Auto-recorded MP4, migrated to Cloudflare R2, replay forever." },
      { name: "Replay chapter markers", detail: "Jump to lot 5 in 2:34 — every sold lot gets a timestamp." },
      { name: "Mobile go-live", detail: "Full-screen portrait publisher; tap to start, swap front/back camera." },
      { name: "OBS + RTMP support", detail: "Pro setups, multi-cam workflows, hardware encoders all welcome." },
    ],
  },
  {
    title: "Buyer experience",
    blurb: "Discovery built for live, not search-first. Watchlist, follow, push, saved searches.",
    items: [
      { name: "Live discovery feed", detail: "Live now + upcoming + recently sold ticker on the home page." },
      { name: "Personalized /feed", detail: "Built from sellers you follow + your watchlist." },
      { name: "Browseable categories", detail: "Curated taxonomy with per-category landing pages." },
      { name: "Faceted search", detail: "Category + kind + price + sort — newest, price asc/desc, most-bids." },
      { name: "Watchlist (lots + shows)", detail: "Heart anything; we ping you when it goes live or restocks." },
      { name: "Follow sellers", detail: "Follower counts surfaced; follows drive the live feed." },
      { name: "Web push notifications", detail: "Outbid · show going live · saved-search match · giveaway won." },
      { name: "SMS notifications (opt-in)", detail: "Twilio-ready; flip on per-kind for transactional pings." },
      { name: "Per-kind notification toggles", detail: "Push / email / SMS, per category. No global all-or-nothing." },
      { name: "Saved searches + daily digest", detail: "Email + push when a new lot matches your saved query." },
      { name: "Add-to-calendar (.ics)", detail: "Apple / Google / Outlook reminder for scheduled shows." },
      { name: "Show-going-live reminders", detail: "Push 5–20 minutes before scheduled shows kick off." },
      { name: "Reviews", detail: "1–5 stars on the seller after delivery; surfaces on /shop." },
      { name: "Disputes", detail: "Buyer-filed; admin resolution pipeline; pre-empts chargebacks." },
      { name: "Buyer support tickets", detail: "/account/help — direct line into the admin inbox." },
    ],
  },
  {
    title: "Seller toolkit",
    blurb: "Everything you need to run a show + grow an audience without app-store gatekeepers.",
    items: [
      { name: "Browser go-live (no OBS)", detail: "One-tap WebRTC publish from desktop." },
      { name: "Mobile go-live page", detail: "Portrait full-screen camera with big tap targets." },
      { name: "Schedule shows + trailers", detail: "Cover image + trailer video pre-roll while you wait." },
      { name: "Pin-a-lot", detail: "'Now selling' overlay regardless of which lot's ringing." },
      { name: "Lot creator (auction / buy_now / mystery / pack-break / flash)", detail: "All five kinds in one form." },
      { name: "24/7 shop", detail: "Buy-Now / Mystery available any time, no live show needed." },
      { name: "Shippo labels (master account)", detail: "One token across the platform — sellers print, never sign up." },
      { name: "Bundle shipping + suggestions", detail: "Combine multiple wins; we surface bundles for the same buyer in 7 days." },
      { name: "Broadcast to followers", detail: "Push + email blast — Whatnot's #1 missing feature." },
      { name: "Announcement composer", detail: "/seller/announce. Capped to one blast per hour." },
      { name: "Auto-bid stack visibility", detail: "See max-bid ladder on a lot before it opens to spot snipers." },
      { name: "Stage tab", detail: "Run-it-again, giveaway create + draw, moderator add/remove, announce shortcut." },
      { name: "Analytics + payouts", detail: "Daily / total breakdowns, top lots, Thursday batch." },
      { name: "Tax form (W-9 / W-8BEN)", detail: "Captured pre-payout; encrypted at rest; 1099-K-ready." },
      { name: "Sales tax automation", detail: "Per-state nexus map; bps rates; line-itemed on every order." },
    ],
  },
  {
    title: "Trust + safety",
    blurb: "Real KYC on sellers, two-factor for everyone, and a moderation stack that doesn't hide behind email.",
    items: [
      { name: "Seller application + KYC", detail: "Identity + business filing review; admin approval workflow." },
      { name: "2FA TOTP", detail: "Google Authenticator / 1Password / Authy — backup codes too." },
      { name: "Moderator chat-delete", detail: "Soft-delete; hosts and mods only; broadcasts a deletion event." },
      { name: "IP blocklist + bot blocker", detail: "Auto-block on suspicious behavior; admin override." },
      { name: "reCAPTCHA on sign-in / sign-up / forgot-password", detail: "Optional, configurable in admin." },
      { name: "Audit log", detail: "Every privileged admin action is appended; no quiet bans." },
      { name: "Disputes pipeline", detail: "Filed by buyers in-product; admin resolves with notes; pushed to both sides." },
      { name: "Chargeback recovery card", detail: "Seller card on file in case rolling reserve runs out." },
    ],
  },
  {
    title: "Platform / DX",
    blurb: "PWA, OG cards, sitemap, robots, and a deploy story that fits in one shell block.",
    items: [
      { name: "PWA installable", detail: "Manifest + service worker; offline shell; web push handler." },
      { name: "Mobile bottom nav", detail: "Live / Browse / Feed / Alerts / Me — sticky on mobile only." },
      { name: "Open Graph + Twitter cards", detail: "Dynamic per-route (homepage / show / shop) generated at request." },
      { name: "Sitemap + robots", detail: "Crawlable for search engines; legal docs separately indexed." },
      { name: "Streak background", detail: "Desktop-only animated pink streaks + random camera-shake." },
      { name: "Toast notifications", detail: "Global useToast() hook; auto-dismiss; max 3 visible." },
      { name: "Victory burst on bid wins", detail: "Pink ring + 12 particles when you take the high bid." },
    ],
  },
];

const COMPARISON: { feature: string; us: string; whatnot: string }[] = [
  { feature: "Platform fee", us: "6%", whatnot: "8%" },
  { feature: "Adult-friendly content", us: "Yes — built in", whatnot: "Restricted" },
  { feature: "Web push notifications", us: "Yes (no app store)", whatnot: "App push only" },
  { feature: "Pre-bid before show goes live", us: "Yes", whatnot: "Yes (limited)" },
  { feature: "Auto-bid (proxy max-bid)", us: "Yes", whatnot: "Yes" },
  { feature: "Broadcast-to-followers", us: "Yes — push + email", whatnot: "Missing (top user complaint)" },
  { feature: "Show recordings + chapter markers", us: "Yes — every lot is a chapter", whatnot: "Recordings only, no chapters" },
  { feature: "Mobile go-live page", us: "Yes — portrait, full-screen", whatnot: "Yes (native app)" },
  { feature: "Bundle shipping suggestions", us: "Yes — across 7-day window", whatnot: "Within one show only" },
  { feature: "Per-kind notification toggles", us: "Yes — push / email / SMS each", whatnot: "Coarse" },
  { feature: "Replay chapter markers", us: "Yes — auto-generated", whatnot: "No" },
  { feature: ".ics calendar export for shows", us: "Yes", whatnot: "No" },
  { feature: "Co-host moderator role", us: "Yes — chat delete + giveaway run", whatnot: "Limited" },
  { feature: "Sub-second WebRTC bidding", us: "Yes", whatnot: "Yes" },
  { feature: "Multi-cam break support", us: "Coming soon", whatnot: "Yes (Fanatics-class)" },
  { feature: "Live customer-support chat", us: "Tickets via /account/help", whatnot: "Email only — slow" },
  { feature: "Authentication service", us: "On the roadmap", whatnot: "Yes (high-value)" },
  { feature: "Native iOS / Android app", us: "PWA — install from browser", whatnot: "Yes" },
  { feature: "Gift cards / coins / tipping", us: "Coming soon", whatnot: "Limited" },
  { feature: "Seller broadcasts (no spam)", us: "1/hour rate-limit", whatnot: "Missing" },
];

export default function FeaturesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Everything in the box
        </p>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Features
        </h1>
        <p className="mt-4 max-w-2xl text-paper/70 sm:text-lg">
          The complete list of what Indie Comics Live does — plus a
          side-by-side with Whatnot so you can see what we&rsquo;re building
          differently.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-12">
            <h2 className="text-2xl font-bold">{s.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-paper/60">{s.blurb}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it) => (
                <li
                  key={it.name}
                  className="icl-glass rounded-2xl p-4 text-sm"
                >
                  <p className="font-bold">{it.name}</p>
                  <p className="mt-1 text-xs text-paper/60">{it.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-16">
          <h2 className="text-2xl font-bold">Indie Comics Live vs Whatnot</h2>
          <p className="mt-1 max-w-3xl text-sm text-paper/60">
            Apples-to-apples on the things buyers and sellers actually feel.
          </p>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-paper/50">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-accent">
                    Indie Comics Live
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-paper/40">
                    Whatnot
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-4 py-3 font-semibold">{row.feature}</td>
                    <td className="px-4 py-3 text-paper">{row.us}</td>
                    <td className="px-4 py-3 text-paper/60">{row.whatnot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-paper/40">
            Whatnot column is a public-records snapshot — features change
            and we&rsquo;ll update this page as they ship parity. Got a
            correction?{" "}
            <Link href="/account/help" className="text-accent hover:underline">
              Tell us
            </Link>
            .
          </p>
        </section>

        <section className="mt-16 rounded-3xl border border-accent/40 bg-accent/[0.06] p-8">
          <h2 className="text-2xl font-bold">Ready to sell?</h2>
          <p className="mt-2 max-w-2xl text-sm text-paper/70">
            6% commission, 2 points under Whatnot. Adult-friendly. Web push
            without an app-store gatekeeper. Apply once and you&rsquo;re live.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/sell"
              className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,51,102,0.4)]"
            >
              Start selling →
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold"
            >
              Watch a show
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
