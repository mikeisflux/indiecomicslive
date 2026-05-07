import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import { searchLots } from "@/lib/search";

export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = await prisma.category
    .findUnique({ where: { slug } })
    .catch(() => null);
  if (!cat) return { title: "Category not found" };
  const description = `Browse ${cat.name} on Indie Comics Live — live auctions, Buy-Now, and mystery lots from indie sellers.`;
  return {
    title: `${cat.name} — Indie Comics Live`,
    description,
    alternates: { canonical: `/category/${cat.slug}` },
    openGraph: {
      title: `${cat.name} on Indie Comics Live`,
      description,
      type: "website",
      url: `/category/${cat.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.name} on Indie Comics Live`,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const sort =
    sp.sort === "price_asc" ||
    sp.sort === "price_desc" ||
    sp.sort === "popular"
      ? sp.sort
      : "newest";

  const cat = await prisma.category
    .findUnique({ where: { slug } })
    .catch(() => null);
  if (!cat) notFound();

  const [hits, liveShows] = await Promise.all([
    searchLots("", {
      categorySlug: cat.slug,
      limit: 60,
      sort: sort as "newest" | "price_asc" | "price_desc" | "popular",
    }),
    prisma.show.findMany({
      where: {
        status: "live",
        lots: { some: { categoryId: cat.id } },
      },
      take: 6,
      include: {
        seller: { select: { handle: true, name: true } },
      },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Category
        </p>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          {cat.iconEmoji && <span className="mr-3">{cat.iconEmoji}</span>}
          {cat.name}
        </h1>
        <p className="mt-3 max-w-2xl text-paper/70">
          Live auctions, Buy-Now, and mystery lots from indie sellers in{" "}
          {cat.name.toLowerCase()}.
        </p>

        {liveShows.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <span className="icl-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
              Live now
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveShows.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/s/${s.id}`}
                    className="block overflow-hidden rounded-2xl border border-accent/30 bg-white/[0.02] transition hover:border-accent/60"
                  >
                    <div className="relative aspect-video bg-black/60">
                      {s.coverImageUrl && (
                        <Image
                          src={s.coverImageUrl}
                          alt={s.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3 text-sm">
                      <p className="line-clamp-1 font-semibold">{s.title}</p>
                      <p className="text-xs text-paper/60">
                        @{s.seller?.handle ?? "seller"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-paper/80">
              All lots
            </h2>
            <div className="flex gap-1.5 text-xs">
              {[
                { v: "newest", label: "Newest" },
                { v: "popular", label: "Most bids" },
                { v: "price_asc", label: "Price ↑" },
                { v: "price_desc", label: "Price ↓" },
              ].map((s) => (
                <Link
                  key={s.v}
                  href={
                    s.v === "newest"
                      ? `/category/${cat.slug}`
                      : `/category/${cat.slug}?sort=${s.v}`
                  }
                  className={`rounded-full border px-3 py-1 ${
                    sort === s.v
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-white/10 text-paper/60 hover:text-paper"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          {hits.length === 0 ? (
            <p className="icl-glass rounded-2xl px-6 py-10 text-center text-paper/60">
              Nothing in {cat.name} right now. Check{" "}
              <Link href="/" className="text-accent hover:underline">
                home
              </Link>{" "}
              or browse a different category.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {hits.map((l) => (
                <li
                  key={l.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-accent/40"
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
                    <div className="relative aspect-square bg-black/40">
                      {l.imageUrl && (
                        <Image
                          src={l.imageUrl}
                          alt={l.title}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-xs font-semibold">
                        {l.title}
                      </p>
                      <p className="font-mono text-sm font-bold">
                        {l.kind === "auction"
                          ? `from ${dollars(l.startingBidCents)}`
                          : dollars(l.buyNowCents ?? 0)}
                      </p>
                      {l.seller.handle && (
                        <p className="text-[10px] text-paper/40">
                          @{l.seller.handle}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
