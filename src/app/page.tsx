import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import RecentlySoldTicker from "@/components/RecentlySoldTicker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
  description:
    "The adult-friendly Whatnot alternative. Live auctions for indie comics, NSFW art books, and trading cards. Sub-second WebRTC bidding, sellers keep more.",
  keywords: [
    "Whatnot alternative",
    "live comics auction",
    "NSFW comics",
    "adult comic auctions",
    "trading cards live auction",
    "indie comics",
    "live shopping",
  ],
  openGraph: {
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. The Whatnot alternative built from day one for NSFW-friendly creators.",
    type: "website",
    siteName: "Indie Comics Live",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. NSFW-friendly from day one.",
  },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Home() {
  const [shows, recentSold, categories, trendingLots, freshLots] =
    await Promise.all([
      prisma.show.findMany({
        where: { status: { in: ["live", "scheduled"] } },
        take: 24,
        orderBy: [{ status: "desc" }, { scheduledFor: "asc" }],
        include: {
          seller: {
            select: { id: true, handle: true, name: true, image: true },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          status: { in: ["paid", "shipped", "delivered"] },
          paidAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 48) },
        },
        orderBy: { paidAt: "desc" },
        take: 20,
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          lot: { select: { title: true, imageUrl: true } },
          seller: { select: { handle: true, name: true } },
        },
      }),
      prisma.category.findMany({
        where: { parentId: null },
        orderBy: { position: "asc" },
        take: 12,
      }),
      prisma.lot.findMany({
        where: {
          showId: null,
          kind: { in: ["buy_now", "mystery"] },
          inventoryCount: { gt: 0 },
          status: { not: "unsold" },
        },
        orderBy: [{ bidCount: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          seller: { select: { handle: true, name: true } },
          _count: { select: { watchers: true } },
        },
      }),
      prisma.lot.findMany({
        where: {
          showId: null,
          kind: { in: ["buy_now", "mystery"] },
          inventoryCount: { gt: 0 },
          status: { not: "unsold" },
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { seller: { select: { handle: true, name: true } } },
      }),
    ]).catch(() => [[], [], [], [], []] as const);

  const live = shows.filter((s) => s.status === "live");
  const upcoming = shows.filter((s) => s.status === "scheduled");

  return (
    <main className="relative">
      <SiteHeader />

      <section className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:pt-20 sm:pb-14">
        <div className="icl-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            <span className="icl-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Live · {live.length} streaming now
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            <span className="icl-shimmer-text">Sub-second</span> live auctions
            <br />
            for <span className="text-accent">indie comics</span>, art books
            <br />
            and trading cards.
          </h1>
          <p className="mt-5 max-w-2xl text-paper/70 sm:text-lg">
            The Whatnot alternative built from day one for adult-friendly
            creators. WebRTC bidding, no app-store gatekeepers, no surprise
            bans. Sellers keep more — buyers pay less.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/sell"
              className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,51,102,0.4)] transition hover:shadow-[0_0_36px_rgba(255,51,102,0.65)]"
            >
              Start selling →
            </Link>
            <Link
              href="#live"
              className="icl-glass rounded-full px-6 py-3 text-sm font-semibold text-paper transition hover:border-white/20"
            >
              Watch a show
            </Link>
            <Link
              href="/search"
              className="rounded-full px-4 py-3 text-sm text-paper/60 hover:text-paper"
            >
              Browse marketplace
            </Link>
          </div>
        </div>
      </section>

      {recentSold.length > 0 && (
        <RecentlySoldTicker
          items={recentSold.map((o) => ({
            id: o.id,
            title: o.lot.title,
            imageUrl: o.lot.imageUrl,
            amount: dollars(o.amountCents),
            seller:
              o.seller.handle ?? o.seller.name ?? "indiecomicslive",
          }))}
        />
      )}

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-paper/40">
            Browse the marketplace
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="icl-glass group flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:border-accent/50 hover:bg-accent/10"
              >
                {c.iconEmoji && (
                  <span className="text-base">{c.iconEmoji}</span>
                )}
                <span className="font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="live" className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-widest">
            <span className="icl-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
            Live now
          </h2>
          {live.length > 0 && (
            <span className="text-xs text-paper/50">
              {live.length} streaming
            </span>
          )}
        </div>
        {live.length === 0 ? (
          <div className="icl-glass rounded-2xl px-6 py-8 text-center text-paper/60">
            No streams live right now. Up next is below — or{" "}
            <Link href="/sell" className="text-accent hover:underline">
              start your own show
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((s) => (
              <ShowCard key={s.id} show={s} live />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-lg font-bold uppercase tracking-widest text-paper/80">
            Up next
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 9).map((s) => (
              <ShowCard key={s.id} show={s} />
            ))}
          </div>
        </section>
      )}

      {trendingLots.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-paper/80">
            Trending in the shop
            <span className="text-base">🔥</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {trendingLots.map((l) => (
              <LotCard
                key={l.id}
                lot={l}
                badge={l._count.watchers > 0 ? `${l._count.watchers} ♥` : null}
              />
            ))}
          </div>
        </section>
      )}

      {freshLots.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="mb-5 text-lg font-bold uppercase tracking-widest text-paper/80">
            Fresh drops
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {freshLots.map((l) => (
              <LotCard key={l.id} lot={l} />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  );

  function ShowCard({
    show,
    live,
  }: {
    show: {
      id: string;
      title: string;
      status: string;
      coverImageUrl: string | null;
      scheduledFor: Date | null;
      seller: {
        handle: string | null;
        name: string | null;
        image: string | null;
      } | null;
    };
    live?: boolean;
  }) {
    return (
      <Link
        href={`/s/${show.id}`}
        className="icl-fade-up group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition hover:border-accent/40 hover:shadow-[0_0_30px_rgba(255,51,102,0.18)]"
      >
        <div className="relative aspect-video overflow-hidden bg-black/60">
          {show.coverImageUrl ? (
            <Image
              src={show.coverImageUrl}
              alt={show.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-paper/20">
              ◆
            </div>
          )}
          {live && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-[0_0_18px_rgba(255,51,102,0.7)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Live
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="line-clamp-1 text-sm font-bold">{show.title}</p>
            <p className="mt-0.5 text-[11px] text-paper/70">
              @{show.seller?.handle ?? "unknown"}
              {show.scheduledFor && show.status === "scheduled" ? (
                <>
                  {" · "}
                  <span className="text-accent">
                    {new Date(show.scheduledFor).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  function LotCard({
    lot,
    badge,
  }: {
    lot: {
      id: string;
      title: string;
      imageUrl: string | null;
      kind: string;
      buyNowCents: number | null;
      inventoryCount: number;
      seller: { handle: string | null; name: string | null } | null;
    };
    badge?: string | null;
  }) {
    return (
      <Link
        href={`/shop/${lot.seller?.handle ?? ""}`}
        className="icl-fade-up group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-accent/40"
      >
        <div className="relative aspect-square overflow-hidden bg-black/40">
          {lot.imageUrl ? (
            <Image
              src={lot.imageUrl}
              alt={lot.title}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : null}
          {lot.kind === "mystery" && (
            <span className="absolute left-2 top-2 rounded-full bg-purple-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-200">
              Mystery
            </span>
          )}
          {badge && (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-paper">
              {badge}
            </span>
          )}
        </div>
        <div className="p-2.5">
          <p className="line-clamp-1 text-xs font-semibold">{lot.title}</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="font-mono text-sm font-bold">
              {dollars(lot.buyNowCents ?? 0)}
            </p>
            <p className="text-[10px] text-paper/40">
              @{lot.seller?.handle ?? ""}
            </p>
          </div>
        </div>
      </Link>
    );
  }
}
