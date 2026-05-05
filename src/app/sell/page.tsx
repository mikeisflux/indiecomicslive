import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title:
    "Sell on Indie Comics Live — adult-friendly Whatnot alternative for comics & cards",
  description:
    "List your indie comics, NSFW art books, and trading cards in live auctions. Sub-second WebRTC bidding, lower fees than Whatnot, no app-store gatekeepers, no surprise bans for adult content.",
  alternates: { canonical: "/sell" },
  openGraph: {
    title: "Sell on Indie Comics Live",
    description:
      "Run live auctions for indie comics and trading cards — adult-friendly from day one.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is adult content allowed?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Indie Comics Live was built from day one to support adult-friendly creators. We use a high-risk-friendly payment processor (Divinity Payments) and self-hosted streaming infrastructure (Ant Media) so you don't have to worry about surprise account bans.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from Whatnot?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Whatnot prohibits adult content and is gated by Apple and Google's app stores. We're web-only (installable as a PWA), allow adult comics and art books, and use sub-second WebRTC for bid timing instead of HLS.",
      },
    },
    {
      "@type": "Question",
      name: "What can I sell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Indie comics, NSFW art books, slabs, raw books, sketch covers, trading cards (sports and TCG), and original art. Anything legal to ship that fits an auction format.",
      },
    },
    {
      "@type": "Question",
      name: "How does payment work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bidders save a card once via a PCI-compliant tokenized form. When they win an auction, we automatically charge their saved card. Payouts to sellers settle through Divinity Payments on a rolling schedule.",
      },
    },
  ],
};

export default function SellLanding() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10">
        <Link href="/" className="text-sm text-paper/60">
          ← Back
        </Link>

        <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          For sellers
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Run live auctions for indie comics and trading cards.
          <br />
          Without the Whatnot rules.
        </h1>
        <p className="mt-5 max-w-2xl text-paper/70 sm:text-lg">
          Indie Comics Live is the adult-friendly Whatnot alternative. Built
          from day one for NSFW-friendly creators &mdash; comics, art books,
          and cards. Sub-second WebRTC bidding, no app-store middleman, no
          surprise bans.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/seller/apply"
            className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white"
          >
            Apply to sell
          </Link>
          <a
            href="#why"
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold"
          >
            How it works
          </a>
        </div>

        <section id="why" className="mt-16 grid gap-6 sm:grid-cols-3">
          <Card
            title="Adult-friendly"
            body="High-risk-friendly payment processor (Divinity Payments) and self-hosted streaming (Ant Media). Your account isn't going to disappear because of a content review."
          />
          <Card
            title="Sub-second bidding"
            body="WebRTC playback under 1s end-to-end. Buyers feel the auction tension; you don't lose bids to lag the way you do on HLS-based platforms."
          />
          <Card
            title="Web-first PWA"
            body="No app store, no 30% in-app purchase tax, no platform veto. Installable on iOS and Android, full-screen, with web push."
          />
          <Card
            title="Real seller payouts"
            body="Settle through Divinity Payments on a rolling schedule. We don't hold funds longer than necessary."
          />
          <Card
            title="Soft-close anti-snipe"
            body="Bids in the last seconds of a lot extend the timer automatically. You sell at fair price; bidders aren't punished for honest behavior."
          />
          <Card
            title="Cards too"
            body="Built for comics first, but the auction engine doesn't care. Slabs, raw, sketch covers, sports, TCG — same flow."
          />
        </section>

        <section className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-bold">FAQ</h2>
          <div className="mt-5 space-y-5">
            <Faq
              q="Is adult content allowed?"
              a="Yes. The whole point of this platform is that adult-friendly creators don't get rugged by ToS changes."
            />
            <Faq
              q="How is this different from Whatnot?"
              a="Whatnot prohibits adult content and runs through the App Store / Play Store. We're web-only (installable as a PWA), allow adult comics and art, and use WebRTC for sub-second bid timing."
            />
            <Faq
              q="What can I sell?"
              a="Indie comics, NSFW art books, slabs, raw books, sketch covers, sports cards, TCG, and original art."
            />
            <Faq
              q="How does payment work?"
              a="Bidders save a card once. Auction wins charge automatically (MIT — merchant-initiated transaction with credential-on-file flags). Failed charges get retried; declined ones are surfaced to the buyer."
            />
          </div>
        </section>

        <section className="mt-12 text-center">
          <Link
            href="/seller/apply"
            className="inline-block rounded-full bg-accent px-7 py-3 text-sm font-bold text-white"
          >
            Apply to sell
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm text-paper/70">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-semibold">{q}</p>
      <p className="mt-1 text-sm text-paper/70">{a}</p>
    </div>
  );
}
