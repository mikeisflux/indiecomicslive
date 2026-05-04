import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_DOC_SLUGS, LEGAL_INDEX } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal — Indie Comics Live",
  description:
    "Terms of Service, Privacy Policy, Seller Agreement, NSFW Policy, and other legal documents for Indie Comics Live, operated by Divinity Comics Inc.",
};

export default function LegalIndex() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Legal</h1>
      <p className="mt-2 text-sm text-paper/60">
        Indie Comics Live is operated by{" "}
        <strong>Divinity Comics Inc.</strong>, an Indiana nonprofit
        corporation.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LEGAL_DOC_SLUGS.map((slug) => (
          <Link
            key={slug}
            href={`/legal/${slug}`}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20"
          >
            <p className="font-semibold">{LEGAL_INDEX[slug].title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-paper/60">
              {LEGAL_INDEX[slug].description}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-paper/40">
              Updated {LEGAL_INDEX[slug].lastUpdated}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
