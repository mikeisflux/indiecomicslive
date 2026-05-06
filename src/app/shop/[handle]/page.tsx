import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import WatchButton from "@/components/WatchButton";
import BuyNowButton from "./BuyNowButton";
import MessageSellerButton from "./MessageSellerButton";

export const dynamic = "force-dynamic";

// Public 24/7 shop for a seller. Lists all the seller's Buy-Now /
// Mystery lots (showId IS NULL) that are still in stock.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const seller = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { name: true, handle: true, bio: true },
  });
  if (!seller) return { title: "Shop not found" };
  const display = seller.name ?? `@${seller.handle}`;
  return {
    title: `${display}'s shop — Indie Comics Live`,
    description: seller.bio ?? `Shop indie comics, art, and trading cards from ${display}.`,
    alternates: { canonical: `/shop/${seller.handle}` },
  };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const seller = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      name: true,
      image: true,
      bio: true,
      location: true,
    },
  });
  if (!seller) notFound();

  const lots = await prisma.lot.findMany({
    where: {
      sellerId: seller.id,
      showId: null,
      kind: { in: ["buy_now", "mystery"] },
      inventoryCount: { gt: 0 },
      status: { not: "unsold" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { images: true } },
    },
  });

  // Reviews aggregate + recent text-body reviews for the seller card
  const [reviewAgg, recentReviews] = await Promise.all([
    prisma.review.aggregate({
      where: { sellerId: seller.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { sellerId: seller.id, body: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        rating: true,
        body: true,
        createdAt: true,
        buyer: { select: { name: true, handle: true } },
      },
    }),
  ]);

  // Pre-resolve which of these lots the current viewer is already
  // watching so the heart icons render in the right state without a
  // client-side round-trip.
  const session = await auth();
  let watchedLotIds = new Set<string>();
  if (session?.user?.id && lots.length > 0) {
    const rows = await prisma.watchedLot.findMany({
      where: {
        userId: session.user.id,
        lotId: { in: lots.map((l) => l.id) },
      },
      select: { lotId: true },
    });
    watchedLotIds = new Set(rows.map((r) => r.lotId));
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
        <header className="flex items-start gap-4">
          <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
            {seller.image ? (
              <Image
                src={seller.image}
                alt={seller.name ?? seller.handle ?? "seller"}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">
              {seller.name ?? `@${seller.handle}`}
            </h1>
            <p className="text-sm text-paper/60">@{seller.handle}</p>
            {seller.bio && (
              <p className="mt-2 max-w-2xl text-sm text-paper/80">
                {seller.bio}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <MessageSellerButton recipientId={seller.id} />
          </div>
        </header>

        {reviewAgg._count._all > 0 && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                <span className="text-amber-300">★</span>
                <span className="ml-1 font-mono">
                  {(reviewAgg._avg.rating ?? 0).toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-paper/60">
                {reviewAgg._count._all} review
                {reviewAgg._count._all === 1 ? "" : "s"} from buyers
              </p>
            </div>
            {recentReviews.length > 0 && (
              <ul className="mt-4 space-y-3 text-sm">
                {recentReviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-white/5 bg-black/30 p-3"
                  >
                    <p className="text-amber-300">
                      {"★".repeat(r.rating)}
                      <span className="text-paper/20">
                        {"★".repeat(5 - r.rating)}
                      </span>
                      <span className="ml-2 text-xs text-paper/50">
                        {r.buyer.name ??
                          (r.buyer.handle ? `@${r.buyer.handle}` : "buyer")}{" "}
                        · {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="mt-1 text-paper/80">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
            24/7 Shop
          </h2>
          {lots.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
              Nothing for sale right now. Check back later — or watch one of
              their live shows.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lots.map((l) => (
                <li
                  key={l.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                >
                  <div className="relative aspect-square bg-black/40">
                    {l.imageUrl ? (
                      <Image
                        src={l.imageUrl}
                        alt={l.title}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                    {l.kind === "mystery" && (
                      <span className="absolute left-3 top-3 rounded-full bg-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                        Mystery
                      </span>
                    )}
                    {l._count.images > 1 && (
                      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-paper">
                        +{l._count.images - 1} more
                      </span>
                    )}
                    <span className="absolute bottom-3 right-3">
                      <WatchButton
                        kind="lot"
                        id={l.id}
                        initial={watchedLotIds.has(l.id)}
                        size="sm"
                        iconOnly
                      />
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 font-semibold">{l.title}</p>
                    {l.description && l.kind !== "mystery" && (
                      <p className="mt-1 line-clamp-2 text-xs text-paper/60">
                        {l.description}
                      </p>
                    )}
                    {l.kind === "mystery" && (
                      <p className="mt-1 text-xs text-paper/60">
                        Hidden contents — revealed on purchase.
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-bold">
                          {dollars(l.buyNowCents ?? 0)}
                        </p>
                        <p className="text-[10px] text-paper/50">
                          {l.shippingCostCents > 0
                            ? `+ ${dollars(l.shippingCostCents)} shipping`
                            : "Free shipping"}
                        </p>
                      </div>
                      <BuyNowButton lotId={l.id} />
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-paper/40">
                      {l.inventoryCount === 1
                        ? "1 left"
                        : `${l.inventoryCount} available`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
