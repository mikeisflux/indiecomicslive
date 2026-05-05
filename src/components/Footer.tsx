import Link from "next/link";

const NAV: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Indie Comics Live",
    links: [
      { href: "/", label: "Home" },
      { href: "/sell", label: "Sell with us" },
      { href: "/about", label: "About" },
      { href: "/orders", label: "My orders" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/seller-agreement", label: "Seller Agreement" },
      { href: "/legal/bidder-agreement", label: "Bidder Agreement" },
      { href: "/legal/content-guidelines", label: "Content Guidelines" },
      { href: "/legal/nsfw", label: "NSFW Policy" },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/legal/refunds", label: "Refund Policy" },
      { href: "/legal/chargebacks", label: "Chargebacks" },
      { href: "/legal/shipping", label: "Shipping" },
      { href: "/legal/pci", label: "PCI Compliance" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/legal/dmca", label: "DMCA" },
      { href: "/legal/fraud", label: "Fraud Prevention" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/gdpr-ccpa", label: "GDPR & CCPA" },
      { href: "/legal/data-deletion", label: "Data Deletion" },
      { href: "/legal/ai", label: "AI Use" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/40 mt-16 px-4 pb-10 pt-12 text-sm text-paper/70">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
        {NAV.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/50">
              {col.title}
            </h3>
            <ul className="space-y-1.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-paper/70 hover:text-paper"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 border-t border-white/5 pt-6 text-xs text-paper/50 sm:flex-row sm:items-center sm:justify-between">
        <p>
          &copy; {new Date().getFullYear()} Divinity Comics Inc. · Indiana
          nonprofit corporation.
        </p>
        <p>
          Indie Comics Live is a wholly operated subsidiary brand of
          Divinity Comics Inc. 18+ adult-friendly auction platform.
        </p>
      </div>
    </footer>
  );
}
