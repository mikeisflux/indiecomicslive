import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "About — Indie Comics Live, a project of Divinity Comics Inc.",
  description:
    "Indie Comics Live is operated by Divinity Comics Inc., an Indiana nonprofit corporation. We build adult-friendly tools for indie comics creators and live-auction sellers who get rugged by mainstream platforms.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Indie Comics Live",
    description:
      "An Indiana nonprofit's adult-friendly Whatnot alternative for comics and trading cards.",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "NGO",
  name: "Divinity Comics Inc.",
  alternateName: "Indie Comics Live",
  legalName: "Divinity Comics Inc.",
  description:
    "Indiana nonprofit corporation operating live-auction and crowdfunding tools for indie comics creators.",
  founder: { "@type": "Person", name: "Divinity Comics Inc." },
  foundingLocation: {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressRegion: "IN", addressCountry: "US" },
  },
  url: "https://indiecomicslive.com",
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <Link href="/" className="text-sm text-paper/60">
          ← Back
        </Link>

        <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          About
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Indie Comics Live is a project of Divinity Comics Inc.
        </h1>
        <p className="mt-5 max-w-2xl text-paper/70 sm:text-lg">
          <strong>Divinity Comics Inc.</strong> is an Indiana nonprofit
          corporation. We build adult-friendly tools for indie comics
          creators and live-auction sellers who get rugged by mainstream
          platforms. Indie Comics Live is one of those tools &mdash; a
          live-auction marketplace for indie comics, NSFW art books, and
          trading cards.
        </p>

        <section className="mt-10 space-y-5 text-paper/80">
          <h2 className="text-xl font-bold text-paper">Why we exist</h2>
          <p>
            Whatnot prohibits adult content. The App Store and Play Store
            prohibit the platforms that allow it. Stripe, Square, and PayPal
            decline to process for &ldquo;high-risk&rdquo; categories, which
            in their world includes most adult-oriented work. The result:
            independent creators who sell adult-friendly content keep
            getting rugged by mainstream platforms &mdash; deplatformed,
            deplatformed again, with funds frozen, sometimes mid-stream.
          </p>
          <p>
            We started Divinity Comics Inc. as a 501(c) Indiana nonprofit so
            adult-friendly creators have a permanent home that isn&rsquo;t
            structured to extract value from them or revoke their access at
            the next ToS update. Indie Comics Live is the auction venue.
            Indiecrowdfund is the campaign venue. The shared mission is the
            same.
          </p>

          <h2 className="text-xl font-bold text-paper">
            How we&rsquo;re structured
          </h2>
          <p>
            Indie Comics Live is a wholly operated subsidiary brand of
            Divinity Comics Inc. Divinity Comics Inc. is the legal operator,
            the merchant of record, and the corporate entity whose Indiana
            registration governs these Services. All seller payouts, refund
            issuance, and chargeback recoup happen through PaymentCloud
            (NMI) under the Divinity Comics Inc. merchant account.
          </p>
          <p>
            Because we&rsquo;re a nonprofit, our revenue covers operations,
            legal, and infrastructure &mdash; not shareholder distributions.
            Surplus is reinvested in the platform and in other adult-
            friendly creator tooling under the Divinity Comics umbrella.
          </p>

          <h2 className="text-xl font-bold text-paper">What we promise</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>We won&rsquo;t change the rules out from under
              you.</strong> Major policy changes are versioned. You can read
              every policy at <Link href="/legal" className="text-accent hover:underline">/legal</Link>.
            </li>
            <li>
              <strong>We don&rsquo;t sell your data.</strong> See{" "}
              <Link href="/legal/privacy" className="text-accent hover:underline">
                Privacy
              </Link>
              .
            </li>
            <li>
              <strong>Card data never touches our servers.</strong> All
              card tokenization happens in your browser via PaymentCloud&rsquo;s
              CollectJS. We hold a vault token, not a card number. See{" "}
              <Link href="/legal/pci" className="text-accent hover:underline">
                PCI Compliance
              </Link>
              .
            </li>
            <li>
              <strong>Real KYC for sellers.</strong> Every approved seller
              passes ID verification + cross-platform fulfillment audit. See
              the{" "}
              <Link
                href="/legal/seller-agreement"
                className="text-accent hover:underline"
              >
                Seller Responsibility Agreement
              </Link>
              .
            </li>
          </ul>

          <h2 className="text-xl font-bold text-paper">Get in touch</h2>
          <p>
            Press, partnerships, or general inquiries:{" "}
            <a
              href="mailto:hello@indiecomicslive.com"
              className="text-accent hover:underline"
            >
              hello@indiecomicslive.com
            </a>
            <br />
            Support:{" "}
            <a
              href="mailto:support@indiecomicslive.com"
              className="text-accent hover:underline"
            >
              support@indiecomicslive.com
            </a>
            <br />
            Trust &amp; Safety:{" "}
            <a
              href="mailto:trust@indiecomicslive.com"
              className="text-accent hover:underline"
            >
              trust@indiecomicslive.com
            </a>
          </p>
        </section>

        <hr className="my-10 border-white/10" />

        <p className="text-xs text-paper/50">
          Divinity Comics Inc. · Indiana nonprofit corporation · Indie Comics
          Live is a wholly operated subsidiary brand of Divinity Comics Inc.
        </p>
      </main>
    </>
  );
}
