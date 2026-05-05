import Link from "next/link";
import { LEGAL_DOC_SLUGS, LEGAL_INDEX } from "@/lib/legal";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">
      <nav className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-paper/60">
          ← Indie Comics Live
        </Link>
        <Link
          href="/about"
          className="text-sm text-paper/60 hover:text-paper"
        >
          About Divinity Comics Inc.
        </Link>
      </nav>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
            Legal
          </h2>
          <ul className="space-y-1 text-sm">
            {LEGAL_DOC_SLUGS.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/legal/${slug}`}
                  className="block rounded-lg px-3 py-1.5 text-paper/70 hover:bg-white/5 hover:text-paper"
                >
                  {LEGAL_INDEX[slug].title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
