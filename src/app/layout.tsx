import type { Metadata, Viewport } from "next";
import PWARegister from "@/components/PWARegister";
import AgeGate from "@/components/AgeGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indie Comics Live",
  description: "Live auctions for independent comics.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IndieLive",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <AgeGate />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
