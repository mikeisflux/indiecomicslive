import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import BuyNowButton from "./BuyNowButton";

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
  });

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
          <div className="min-w-0">
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
        </header>

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
                      <span className="font-mono text-sm font-bold">
                        {dollars(l.buyNowCents ?? 0)}
                      </span>
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
