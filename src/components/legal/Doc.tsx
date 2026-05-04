import { LEGAL_INDEX, type LegalSlug } from "@/lib/legal";

export default function Doc({
  slug,
  children,
}: {
  slug: LegalSlug;
  children: React.ReactNode;
}) {
  const meta = LEGAL_INDEX[slug];
  return (
    <article className="space-y-5 text-paper/80">
      <header className="border-b border-white/10 pb-5">
        <h1 className="text-3xl font-bold text-paper">{meta.title}</h1>
        <p className="mt-2 text-sm text-paper/60">
          Last updated: <strong>{meta.lastUpdated}</strong>
        </p>
        <p className="mt-2 text-sm text-paper/60">{meta.description}</p>
      </header>
      <div className="space-y-5 leading-relaxed [&_a]:text-accent [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-paper [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-paper [&_li]:my-1 [&_strong]:text-paper [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
      <aside className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm">
        <p className="font-semibold text-paper">Operated by</p>
        <p className="mt-1">
          Divinity Comics Inc., an Indiana nonprofit corporation. Indie Comics
          Live is a wholly operated subsidiary brand of Divinity Comics Inc.
        </p>
        <p className="mt-3">
          Questions:{" "}
          <a href="mailto:support@indiecomicslive.com">support@indiecomicslive.com</a>
        </p>
      </aside>
    </article>
  );
}
