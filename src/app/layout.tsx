import type { Metadata, Viewport } from "next";
import PWARegister from "@/components/PWARegister";
import AgeGate from "@/components/AgeGate";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indiecomics.live";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "Indie Comics Live — Whatnot alternative for adult comics & cards",
    template: "%s",
  },
  description:
    "The Whatnot alternative built from day one for NSFW-friendly creators. Live auctions for adult comics, indie books, and trading cards — with sub-second WebRTC bidding and lower seller fees.",
  applicationName: "Indie Comics Live",
  keywords: [
    "Whatnot alternative",
    "live comic auctions",
    "NSFW comics",
    "adult comics live",
    "trading cards live auction",
    "live shopping comics",
    "indie comics auction",
    "adult-friendly live shopping",
    "comic auction stream",
    "Whatnot for adult content",
  ],
  authors: [{ name: "Indie Comics Live" }],
  category: "shopping",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IndieLive",
    statusBarStyle: "black-translucent",
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Indie Comics Live",
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. NSFW-friendly from day one. No app stores, no surprise bans.",
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. NSFW-friendly from day one.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Indie Comics Live",
  url: siteUrl,
  description:
    "Live-auction platform for indie comics and trading cards. Adult-content friendly Whatnot alternative.",
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Indie Comics Live",
  url: siteUrl,
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-dvh">
        <AgeGate />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
