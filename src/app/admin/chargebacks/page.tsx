import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chargebacks — Admin" };

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Chargebacks land here via /api/webhooks/nmi flipping the affected
// order to status=cancelled. We surface those plus refunded orders so
// admins can see the dispute pattern in one place.
export default async function ChargebacksAdmin() {
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [cancelled, refunded, totalPaid30d, sellersWithChargebacks] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: "cancelled" },
        include: {
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true, handle: true } },
          lot: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.order.findMany({
        where: { status: "refunded" },
        include: {
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true, handle: true } },
          lot: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.order.aggregate({
        where: { status: "paid", paidAt: { gte: since30d } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["sellerId"],
        where: { status: "cancelled", createdAt: { gte: since30d } },
        _count: true,
        _sum: { amountCents: true },
      }),
    ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Chargebacks &amp; refunds</h1>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Chargebacks 30d"
          value={cancelled.filter((o) => o.createdAt >= since30d).length}
        />
        <Stat label="Paid orders 30d" value={totalPaid30d._count} />
        <Stat
          label="Chargeback rate 30d"
          value={
            totalPaid30d._count > 0
              ? `${((cancelled.filter((o) => o.createdAt >= since30d).length / totalPaid30d._count) * 100).toFixed(2)}%`
              : "—"
          }
        />
      </div>

      {sellersWithChargebacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
            Sellers with chargebacks (30d)
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
                <tr>
                  <th className="px-3 py-2">Seller</th>
                  <th className="px-3 py-2">Count</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sellersWithChargebacks.map((row) => (
                  <tr key={row.sellerId}>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/admin/users/${row.sellerId}`}
                        className="hover:underline"
                      >
                        {row.sellerId.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{row._count}</td>
                    <td className="px-3 py-2 text-xs">
                      {dollars(row._sum.amountCents ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Chargebacks
        </h2>
        <OrderTable rows={cancelled} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Refunds
        </h2>
        <OrderTable rows={refunded} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function OrderTable({
  rows,
}: {
  rows: Array<{
    id: string;
    amountCents: number;
    createdAt: Date;
    nmiTransactionId: string | null;
    buyer: { id: string; email: string };
    seller: { id: string; email: string; handle: string | null };
    lot: { title: string };
  }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-paper/50">None.</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
          <tr>
            <th className="px-3 py-2">Order</th>
            <th className="px-3 py-2">Buyer</th>
            <th className="px-3 py-2">Seller</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Txn</th>
            <th className="px-3 py-2">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="text-paper hover:underline"
                >
                  {o.lot.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs">
                <Link
                  href={`/admin/users/${o.buyer.id}`}
                  className="hover:underline"
                >
                  {o.buyer.email}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs">
                <Link
                  href={`/admin/users/${o.seller.id}`}
                  className="hover:underline"
                >
                  @{o.seller.handle ?? o.seller.email}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs">
                ${(o.amountCents / 100).toFixed(2)}
              </td>
              <td className="px-3 py-2 font-mono text-[10px] text-paper/50">
                {o.nmiTransactionId ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-paper/60">
                {new Date(o.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
