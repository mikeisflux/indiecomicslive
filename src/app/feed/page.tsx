import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your feed — Indie Comics Live",
  robots: { index: false, follow: false },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/feed");

  const myId = session.user.id;
  const follows = await prisma.follow.findMany({
    where: { followerId: myId },
    select: { sellerId: true },
  });
  const followedIds = follows.map((f) => f.sellerId);

  const [liveFromFollowed, upcomingFromFollowed, freshFromFollowed, watchedLots] =
    await Promise.all([
      followedIds.length > 0
        ? prisma.show.findMany({
            where: {
              sellerId: { in: followedIds },
              status: "live",
            },
            orderBy: { startedAt: "desc" },
            take: 8,
            include: {
              seller: { select: { handle: true, name: true, image: true } },
            },
          })
        : Promise.resolve([]),
      followedIds.length > 0
        ? prisma.show.findMany({
            where: {
              sellerId: { in: followedIds },
              status: "scheduled",
            },
            orderBy: { scheduledFor: "asc" },
            take: 12,
            include: {
              seller: { select: { handle: true, name: true } },
            },
          })
        : Promise.resolve([]),
      followedIds.length > 0
        ? prisma.lot.findMany({
            where: {
              sellerId: { in: followedIds },
              showId: null,
              kind: { in: ["buy_now", "mystery"] },
              inventoryCount: { gt: 0 },
              status: { not: "unsold" },
              createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
            },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: {
              seller: { select: { handle: true, name: true } },
            },
          })
        : Promise.resolve([]),
      prisma.watchedLot.findMany({
        where: { userId: myId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          lot: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              buyNowCents: true,
              startingBidCents: true,
              kind: true,
              show: { select: { id: true, status: true } },
              seller: { select: { handle: true } },
            },
          },
        },
      }),
    ]);

  const empty =
    liveFromFollowed.length === 0 &&
    upcomingFromFollowed.length === 0 &&
    freshFromFollowed.length === 0 &&
    watchedLots.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <h1 className="text-3xl font-black">Your feed</h1>
        <p className="mt-1 text-sm text-paper/60">
          Built from the {followedIds.length}{" "}
          seller{followedIds.length === 1 ? "" : "s"} you follow + your
          watchlist.
        </p>

        {empty && (
          <div className="icl-glass mt-8 rounded-2xl p-8 text-center">
            <p className="text-paper/70">
              Nothing yet. Find sellers to follow on the homepage or in
              search.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-white/15 px-4 py-2 text-xs"
              >
                Browse home
              </Link>
              <Link
                href="/search"
                className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white"
              >
                Search lots
              </Link>
            </div>
          </div>
        )}

        {liveFromFollowed.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <span className="icl-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" />
              Live now from your follows
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveFromFollowed.map((s) => (
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
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Live
                      </span>
                    </div>
                    <div className="p-3 text-sm">
                      <p className="line-clamp-1 font-semibold">{s.title}</p>
                      <p className="text-xs text-paper/60">
                        @{s.seller.handle ?? "seller"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {upcomingFromFollowed.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-paper/80">
              Up next
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingFromFollowed.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm"
                >
                  <p className="line-clamp-1 font-semibold">{s.title}</p>
                  <p className="text-xs text-paper/60">
                    @{s.seller.handle ?? "seller"}
                    {s.scheduledFor && (
                      <>
                        {" · "}
                        <span className="text-accent">
                          {new Date(s.scheduledFor).toLocaleString()}
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {freshFromFollowed.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-paper/80">
              Fresh from your sellers
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {freshFromFollowed.map((l) => (
                <li
                  key={l.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <Link
                    href={`/shop/${l.seller?.handle ?? ""}`}
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
                        {dollars(l.buyNowCents ?? 0)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {watchedLots.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-paper/80">
              Your watchlist
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {watchedLots.map((w) => (
                <li
                  key={w.lot.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <Link
                    href={
                      w.lot.show
                        ? `/s/${w.lot.show.id}`
                        : `/shop/${w.lot.seller?.handle ?? ""}`
                    }
                    className="block"
                  >
                    <div className="relative aspect-square bg-black/40">
                      {w.lot.imageUrl && (
                        <Image
                          src={w.lot.imageUrl}
                          alt={w.lot.title}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-xs font-semibold">
                        {w.lot.title}
                      </p>
                      <p className="font-mono text-sm font-bold">
                        {w.lot.kind === "auction"
                          ? `from ${dollars(w.lot.startingBidCents)}`
                          : dollars(w.lot.buyNowCents ?? 0)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
