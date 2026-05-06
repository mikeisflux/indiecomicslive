import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import {
  getBuyerStats,
  getFollowedShowsForBuyer,
  carrierTrackingUrl,
} from "@/lib/buyer-stats";
import OrdersList, { type OrderRow } from "./OrdersList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buyer dashboard — Indie Comics Live",
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function BuyerDashboard() {
  const me = await requireOnboardedUser("/orders");

  const [orders, stats, liveShows] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: me.id },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        lot: { select: { title: true, imageUrl: true, kind: true } },
        seller: { select: { handle: true, name: true } },
      },
    }),
    getBuyerStats(me.id),
    getFollowedShowsForBuyer(me.id),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    title: o.lot.title ?? "(untitled lot)",
    imageUrl: o.lot.imageUrl,
    kind: o.lot.kind as unknown as "auction" | "buy_now" | "mystery",
    amountCents: o.amountCents,
    status: o.status as unknown as string,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    trackingNumber: o.trackingNumber,
    shippingCarrier: o.shippingCarrier,
    trackingUrl: carrierTrackingUrl(o.shippingCarrier, o.trackingNumber),
    sellerHandle: o.seller.handle,
    sellerName: o.seller.name,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Buyer dashboard</h1>
          <p className="mt-1 text-sm text-paper/60">
            Your orders, in-flight packages, and live shows from people you
            follow.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href="/account/payment-method"
            className="rounded-full border border-white/15 px-3 py-1.5 font-semibold"
          >
            Payment method
          </Link>
          <Link
            href="/account/addresses"
            className="rounded-full border border-white/15 px-3 py-1.5 font-semibold"
          >
            Addresses
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total spent"
          value={dollars(stats.totalSpentCents)}
          sub={`${stats.totalOrders} orders`}
        />
        <Stat
          label="In-flight"
          value={String(stats.inFlightCount)}
          sub={
            stats.inFlightCount > 0
              ? `${dollars(stats.inFlightValueCents)} on the way`
              : "Nothing in transit"
          }
        />
        <Stat
          label="Delivered"
          value={String(stats.deliveredCount)}
          sub="Confirmed delivered"
        />
        <Stat
          label="Saved vs Whatnot"
          value={dollars(stats.savedVsWhatnotCents)}
          sub="Estimated 2pt fee delta"
        />
      </section>

      {liveShows.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
            From sellers you follow
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveShows.map((s) => (
              <li
                key={s.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
              >
                <Link href={`/s/${s.id}`} className="block">
                  <div className="relative aspect-video bg-black/40">
                    {s.coverImageUrl ? (
                      <Image
                        src={s.coverImageUrl}
                        alt={s.title}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                    {s.status === "live" && (
                      <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-semibold">
                      {s.title}
                    </p>
                    <p className="text-xs text-paper/60">
                      @{s.seller.handle ?? "unknown"}
                      {s.scheduledFor && s.status === "scheduled"
                        ? ` · ${new Date(s.scheduledFor).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Orders
        </h2>
        <OrdersList orders={rows} />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-paper/50">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-paper/50">{sub}</p>
    </div>
  );
}
