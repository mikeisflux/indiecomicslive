// Central registry of every legal document on the site. Each entry has
// a slug (for /legal/<slug>), title, sidebar nav order, the
// last-updated date, and a render function that returns JSX.
//
// Verbiage borrows the structure of indiecrowdfund_2.0's legal docs and
// is adapted for our auction-platform context, with **Divinity Comics
// Inc.** (an Indiana nonprofit corporation) as the platform operator
// and Indie Comics Live as the platform brand.
//
// When you materially change any of these, bump the document's
// `lastUpdated` and bump AGREEMENT_VERSION in
// src/app/api/seller/applications/route.ts so we re-prompt sellers.

export const PARENT_ENTITY = "Divinity Comics Inc.";
export const PARENT_ENTITY_DESCRIPTOR =
  "an Indiana nonprofit corporation";
export const BRAND = "Indie Comics Live";
export const SITE_HOST = "indiecomics.live";
export const SUPPORT_EMAIL = "support@indiecomics.live";
export const PRIVACY_EMAIL = "privacy@indiecomics.live";
export const SELLERS_EMAIL = "sellers@indiecomics.live";
export const TRUST_EMAIL = "trust@indiecomics.live";
export const DMCA_EMAIL = "dmca@indiecomics.live";

export const LEGAL_DOC_SLUGS = [
  "terms",
  "privacy",
  "seller-agreement",
  "bidder-agreement",
  "content-guidelines",
  "nsfw",
  "refunds",
  "chargebacks",
  "shipping",
  "dmca",
  "fraud",
  "cookies",
  "gdpr-ccpa",
  "data-deletion",
  "ai",
  "pci",
] as const;

export type LegalSlug = (typeof LEGAL_DOC_SLUGS)[number];

export const LEGAL_INDEX: Record<
  LegalSlug,
  { title: string; lastUpdated: string; description: string }
> = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "May 1, 2026",
    description:
      "The agreement between you and Divinity Comics Inc. governing use of Indie Comics Live.",
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "May 1, 2026",
    description:
      "How we collect, use, and protect your personal information.",
  },
  "seller-agreement": {
    title: "Seller Responsibility Agreement",
    lastUpdated: "May 1, 2026",
    description:
      "What you agree to as an approved seller running live auctions on Indie Comics Live.",
  },
  "bidder-agreement": {
    title: "Bidder Agreement",
    lastUpdated: "May 1, 2026",
    description:
      "What you agree to when you bid on a live lot, including the auction-win payment authorization.",
  },
  "content-guidelines": {
    title: "Content Guidelines",
    lastUpdated: "May 1, 2026",
    description:
      "What you can and can't list, stream, or post on Indie Comics Live.",
  },
  nsfw: {
    title: "NSFW Policy",
    lastUpdated: "May 1, 2026",
    description:
      "Adult-content rules for sellers, listings, livestreams, and chat.",
  },
  refunds: {
    title: "Refund Policy",
    lastUpdated: "May 1, 2026",
    description:
      "When refunds are available, how to request one, and what's not eligible.",
  },
  chargebacks: {
    title: "Chargebacks Policy",
    lastUpdated: "May 1, 2026",
    description:
      "How chargebacks are handled, including seller chargeback recoup against on-file cards and rolling reserves.",
  },
  shipping: {
    title: "Shipping Policy",
    lastUpdated: "May 1, 2026",
    description:
      "Seller shipping obligations, timelines, and lost-package handling.",
  },
  dmca: {
    title: "DMCA Policy",
    lastUpdated: "May 1, 2026",
    description: "How to file a DMCA takedown notice and counter-notice.",
  },
  fraud: {
    title: "Fraud Prevention Policy",
    lastUpdated: "May 1, 2026",
    description:
      "How we detect and respond to fraud, including shill bidding, account takeover, and synthetic-ID abuse.",
  },
  cookies: {
    title: "Cookie Policy",
    lastUpdated: "May 1, 2026",
    description: "What cookies we set and how to opt out.",
  },
  "gdpr-ccpa": {
    title: "GDPR & CCPA Notice",
    lastUpdated: "May 1, 2026",
    description: "Your rights under EU and California privacy law.",
  },
  "data-deletion": {
    title: "Data Deletion Policy",
    lastUpdated: "May 1, 2026",
    description:
      "How to delete your account and what data is preserved for legal/financial compliance.",
  },
  ai: {
    title: "AI Use Policy",
    lastUpdated: "May 1, 2026",
    description:
      "How we use AI internally and what's required when sellers list AI-generated content.",
  },
  pci: {
    title: "PCI Compliance Statement",
    lastUpdated: "May 1, 2026",
    description:
      "How card data is handled — tokenized in the browser, never stored on our servers.",
  },
};
