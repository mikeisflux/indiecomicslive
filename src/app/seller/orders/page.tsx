import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import OrdersList from "./OrdersList";
import SuggestedBundles from "./SuggestedBundles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orders — Seller",
};

export default async function SellerOrders() {
  const me = await requireOnboardedUser("/seller/orders");

  const orders = await prisma.order.findMany({
    where: { sellerId: me.id, status: { in: ["paid", "shipped", "delivered"] } },
    orderBy: [{ deliveredAt: "asc" }, { paidAt: "desc" }],
    include: {
      lot: { select: { id: true, title: true } },
      buyer: { select: { id: true, name: true, handle: true, email: true } },
    },
    take: 200,
  });

  // Suggested bundles — group unbundled, unshipped, paid orders by
  // buyer and propose any cluster of 2+ from the last 7 days.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const bundleCandidates = orders.filter(
    (o) =>
      o.status === "paid" &&
      !o.shippedAt &&
      !o.shipmentId &&
      o.paidAt &&
      o.paidAt.getTime() >= cutoff,
  );
  const groups = new Map<
    string,
    {
      buyer: { id: string; name: string | null; handle: string | null };
      orders: { id: string; title: string; amountCents: number }[];
    }
  >();
  for (const o of bundleCandidates) {
    const key = o.buyer.id;
    const g = groups.get(key) ?? {
      buyer: { id: o.buyer.id, name: o.buyer.name, handle: o.buyer.handle },
      orders: [],
    };
    g.orders.push({
      id: o.id,
      title: o.lot.title ?? "(untitled lot)",
      amountCents: o.amountCents,
    });
    groups.set(key, g);
  }
  const suggestions = [...groups.values()].filter((g) => g.orders.length >= 2);

  const rows = orders.map((o) => ({
    id: o.id,
    amountCents: o.amountCents,
    status: o.status as unknown as string,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    trackingNumber: o.trackingNumber,
    shipmentId: o.shipmentId,
    paidAt: o.paidAt?.toISOString() ?? null,
    buyer: {
      id: o.buyer.id,
      name: o.buyer.name,
      handle: o.buyer.handle,
      email: o.buyer.email,
    },
    lot: { title: o.lot.title },
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-8">
      <Link href="/seller" className="text-sm text-paper/60 hover:text-paper">
        ← Seller Dashboard
      </Link>
      <div className="mb-6 mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-paper/60">
            Print labels here. Bundle multiple wins from the same buyer to
            save on shipping. Payouts run weekly on Thursdays for items
            tracked-confirmed delivered.
          </p>
        </div>
        <Link
          href="/seller/ship-from"
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold"
        >
          Return address
        </Link>
      </div>

      {suggestions.length > 0 && <SuggestedBundles groups={suggestions} />}

      <OrdersList orders={rows} />
    </main>
  );
}
