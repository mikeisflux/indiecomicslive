import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { searchLots } from "@/lib/search";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SaveSearchButton from "./SaveSearchButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search — Indie Comics Live",
  description: "Search lots across every seller on Indie Comics Live.",
  alternates: { canonical: "/search" },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const KINDS = [
  { v: "", label: "All" },
  { v: "auction", label: "Auctions" },
  { v: "buy_now", label: "Buy now" },
  { v: "mystery", label: "Mystery" },
] as const;

const SORTS = [
  { v: "newest", label: "Newest" },
  { v: "price_asc", label: "Price ↑" },
  { v: "price_desc", label: "Price ↓" },
  { v: "popular", label: "Most bids" },
] as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    kind?: string;
    min?: string;
    max?: string;
    sort?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const cat = (sp.cat ?? "").trim() || null;
  const kind =
    sp.kind === "auction" || sp.kind === "buy_now" || sp.kind === "mystery"
      ? sp.kind
      : null;
  const minCents = sp.min ? Math.max(0, Math.round(Number(sp.min) * 100)) : null;
  const maxCents = sp.max ? Math.max(0, Math.round(Number(sp.max) * 100)) : null;
  const sort =
    sp.sort === "price_asc" ||
    sp.sort === "price_desc" ||
    sp.sort === "popular"
      ? sp.sort
      : "newest";

  const [hits, categories] = await Promise.all([
    searchLots(q, {
      limit: 60,
      categorySlug: cat,
      kind,
      minCents,
      maxCents,
      sort,
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { position: "asc" },
    }),
  ]);

  let alreadySaved = false;
  const session = await auth();
  if (q && session?.user?.id) {
    const existing = await prisma.savedSearch.findFirst({
      where: { userId: session.user.id, query: q },
      select: { id: true },
    });
    alreadySaved = !!existing;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        <form className="flex gap-2" action="/search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search lots — comics, art, cards…"
            className="flex-1 rounded-full border border-white/15 bg-black/40 px-5 py-3 text-sm focus:border-accent focus:outline-none"
            autoFocus={!q}
          />
          {cat && <input type="hidden" name="cat" value={cat} />}
          {kind && <input type="hidden" name="kind" value={kind} />}
          {sp.min && <input type="hidden" name="min" value={sp.min} />}
          {sp.max && <input type="hidden" name="max" value={sp.max} />}
          {sort !== "newest" && (
            <input type="hidden" name="sort" value={sort} />
          )}
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,51,102,0.35)]"
          >
            Search
          </button>
        </form>

        <div className="mt-4 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-5 text-sm">
            <FacetGroup title="Category">
              <div className="flex flex-col gap-1">
                <FacetLink
                  active={!cat}
                  href={makeHref({ q, kind, sort, sp })}
                >
                  All
                </FacetLink>
                {categories.map((c) => (
                  <FacetLink
                    key={c.id}
                    active={cat === c.slug}
                    href={makeHref({ q, kind, sort, sp, cat: c.slug })}
                  >
                    {c.iconEmoji && (
                      <span className="mr-1.5">{c.iconEmoji}</span>
                    )}
                    {c.name}
                  </FacetLink>
                ))}
              </div>
            </FacetGroup>

            <FacetGroup title="Type">
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <FacetChip
                    key={k.v}
                    active={(kind ?? "") === k.v}
                    href={makeHref({
                      q,
                      cat,
                      sort,
                      sp,
                      kind: k.v || null,
                    })}
                  >
                    {k.label}
                  </FacetChip>
                ))}
              </div>
            </FacetGroup>

            <FacetGroup title="Price">
              <form
                action="/search"
                className="flex items-center gap-2"
                method="get"
              >
                {q && <input type="hidden" name="q" value={q} />}
                {cat && <input type="hidden" name="cat" value={cat} />}
                {kind && <input type="hidden" name="kind" value={kind} />}
                {sort !== "newest" && (
                  <input type="hidden" name="sort" value={sort} />
                )}
                <input
                  name="min"
                  defaultValue={sp.min ?? ""}
                  placeholder="$ min"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
                <span className="text-paper/40">–</span>
                <input
                  name="max"
                  defaultValue={sp.max ?? ""}
                  placeholder="$ max"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
              </form>
            </FacetGroup>

            <FacetGroup title="Sort">
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map((s) => (
                  <FacetChip
                    key={s.v}
                    active={sort === s.v}
                    href={makeHref({
                      q,
                      cat,
                      kind,
                      sp,
                      sort: s.v,
                    })}
                  >
                    {s.label}
                  </FacetChip>
                ))}
              </div>
            </FacetGroup>
          </aside>

          <section>
            {(q || cat || kind) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-paper/60">
                  {hits.length === 0 ? (
                    "No matches."
                  ) : (
                    <>
                      {hits.length} result{hits.length === 1 ? "" : "s"}
                      {q ? (
                        <>
                          {" for "}
                          <span className="text-paper">
                            &ldquo;{q}&rdquo;
                          </span>
                        </>
                      ) : null}
                    </>
                  )}
                </p>
                {q && (
                  <SaveSearchButton query={q} alreadySaved={alreadySaved} />
                )}
              </div>
            )}

            {hits.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hits.map((l) => (
                  <li
                    key={l.id}
                    className="icl-fade-up overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-accent/40 hover:shadow-[0_0_22px_rgba(255,51,102,0.15)]"
                  >
                    <Link
                      href={
                        l.show
                          ? `/s/${l.show.id}`
                          : l.seller.handle
                            ? `/shop/${l.seller.handle}`
                            : "/"
                      }
                      className="block"
                    >
                      <div className="relative aspect-square overflow-hidden bg-black/40">
                        {l.imageUrl ? (
                          <Image
                            src={l.imageUrl}
                            alt={l.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover transition-transform duration-500 hover:scale-105"
                          />
                        ) : null}
                        {l.kind === "mystery" && (
                          <span className="absolute left-3 top-3 rounded-full bg-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                            Mystery
                          </span>
                        )}
                        {l.show && (
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Live
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="line-clamp-2 font-semibold">{l.title}</p>
                        <p className="mt-1 text-xs text-paper/60">
                          {l.kind === "auction"
                            ? `Auction · start ${dollars(l.startingBidCents)}`
                            : `${dollars(l.buyNowCents ?? 0)}`}
                          {l.seller.handle ? ` · @${l.seller.handle}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="icl-glass rounded-2xl px-6 py-12 text-center text-paper/60">
                {q || cat || kind
                  ? "Nothing matched your filters."
                  : "Pick a category or type to start browsing."}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function FacetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-paper/40">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FacetLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition ${
        active
          ? "bg-accent/15 text-accent"
          : "text-paper/70 hover:bg-white/5 hover:text-paper"
      }`}
    >
      {children}
    </Link>
  );
}

function FacetChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-white/10 text-paper/60 hover:border-white/30 hover:text-paper"
      }`}
    >
      {children}
    </Link>
  );
}

function makeHref(opts: {
  q?: string;
  cat?: string | null;
  kind?: string | null;
  sort?: string;
  sp: { min?: string; max?: string };
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.cat) p.set("cat", opts.cat);
  if (opts.kind) p.set("kind", opts.kind);
  if (opts.sort && opts.sort !== "newest") p.set("sort", opts.sort);
  if (opts.sp.min) p.set("min", opts.sp.min);
  if (opts.sp.max) p.set("max", opts.sp.max);
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}
