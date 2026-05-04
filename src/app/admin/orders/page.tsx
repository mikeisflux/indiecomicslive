import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders — Admin" };

const TABS: (OrderStatus | "all")[] = [
  "all",
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "refunded",
  "cancelled",
];

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function OrdersList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status ?? "all") as OrderStatus | "all";
  const q = sp.q?.trim() ?? "";

  const orders = await prisma.order.findMany({
    where: {
      ...(status !== "all" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { id: { equals: q } },
              { nmiTransactionId: { equals: q } },
              { buyer: { email: { contains: q, mode: "insensitive" } } },
              { seller: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      buyer: { select: { id: true, email: true, handle: true } },
      seller: { select: { id: true, email: true, handle: true } },
      lot: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <form className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Order ID, txn ID, buyer/seller email"
            className="w-72 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Search
          </button>
        </form>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1 ${
              status === s
                ? "bg-accent text-white"
                : "border border-white/10 text-paper/70"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Buyer</th>
              <th className="px-3 py-2">Seller</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Txn</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="block text-paper"
                  >
                    <p className="font-semibold">{o.lot.title}</p>
                    <p className="font-mono text-[10px] text-paper/40">
                      {o.id.slice(0, 8)}…
                    </p>
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">
                  <Link
                    href={`/admin/users/${o.buyer.id}`}
                    className="hover:underline"
                  >
                    @{o.buyer.handle ?? o.buyer.email}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">
                  <Link
                    href={`/admin/users/${o.seller.id}`}
                    className="hover:underline"
                  >
                    @{o.seller.handle ?? o.seller.email}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">
                  {dollars(o.amountCents)}
                </td>
                <td className="px-3 py-3 text-xs capitalize">
                  {o.status.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-3 font-mono text-[10px] text-paper/50">
                  {o.nmiTransactionId
                    ? `${o.nmiTransactionId.slice(0, 10)}…`
                    : "—"}
                </td>
                <td className="px-3 py-3 text-xs text-paper/60">
                  {new Date(o.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
