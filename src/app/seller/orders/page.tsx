import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import OrdersList from "./OrdersList";

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
      <div className="mb-6 flex items-end justify-between">
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

      <OrdersList orders={rows} />
    </main>
  );
}
