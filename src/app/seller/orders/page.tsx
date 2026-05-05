import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orders — Seller",
};

function statusBadge(o: {
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  trackingNumber: string | null;
}): { label: string; tone: string } {
  if (o.deliveredAt) return { label: "Delivered", tone: "bg-emerald-500/20 text-emerald-300" };
  if (o.shippedAt) return { label: "Shipped", tone: "bg-sky-500/20 text-sky-300" };
  if (o.status === "paid") return { label: "Awaiting label", tone: "bg-amber-500/20 text-amber-300" };
  if (o.status === "refunded") return { label: "Refunded", tone: "bg-paper/10 text-paper/60" };
  if (o.status === "cancelled") return { label: "Cancelled", tone: "bg-paper/10 text-paper/60" };
  return { label: o.status, tone: "bg-white/10 text-paper/70" };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function SellerOrders() {
  const me = await requireOnboardedUser("/seller/orders");

  const orders = await prisma.order.findMany({
    where: { sellerId: me.id, status: { in: ["paid", "shipped", "delivered"] } },
    orderBy: [{ deliveredAt: "asc" }, { paidAt: "desc" }],
    include: {
      lot: { select: { id: true, title: true } },
      buyer: { select: { name: true, handle: true, email: true } },
    },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-paper/60">
            Print labels here. Payouts run weekly on Thursdays for items
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

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          No paid orders yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {orders.map((o) => {
            const b = statusBadge(o);
            return (
              <li key={o.id}>
                <Link
                  href={`/seller/orders/${o.id}`}
                  className="block px-5 py-3 text-sm hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {o.lot.title || "(untitled lot)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-paper/50">
                        {dollars(o.amountCents)} ·{" "}
                        {o.buyer.name ?? o.buyer.handle ?? o.buyer.email}
                        {o.trackingNumber ? ` · ${o.trackingNumber}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${b.tone}`}
                    >
                      {b.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
