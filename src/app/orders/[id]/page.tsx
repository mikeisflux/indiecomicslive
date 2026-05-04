import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import OrderActions from "./OrderActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order — Indie Comics Live",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireOnboardedUser(`/orders/${id}`);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lot: { select: { title: true, imageUrl: true, description: true } },
      seller: { select: { handle: true, name: true } },
    },
  });
  if (!order) notFound();
  if (order.buyerId !== me.id) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <a href="/orders" className="text-sm text-paper/60">
        ← All orders
      </a>
      <h1 className="mt-3 mb-1 text-2xl font-bold">{order.lot.title}</h1>
      <p className="mb-6 text-xs text-paper/60">
        From @{order.seller.handle ?? "unknown"} ·{" "}
        {new Date(order.createdAt).toLocaleString()}
      </p>

      {order.lot.imageUrl && (
        <img
          src={order.lot.imageUrl}
          alt={order.lot.title}
          className="mb-6 w-full rounded-2xl object-cover"
        />
      )}

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-paper/60">Total</span>
          <span className="text-xl font-bold">
            ${(order.amountCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-paper/60">Status</span>
          <StatusPill status={order.status} />
        </div>
        {order.nmiTransactionId && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-paper/60">Transaction</span>
            <span className="font-mono text-xs">{order.nmiTransactionId}</span>
          </div>
        )}
        {order.trackingNumber && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-paper/60">Tracking</span>
            <span className="font-mono text-xs">{order.trackingNumber}</span>
          </div>
        )}
      </div>

      <div className="mt-6">
        <OrderActions orderId={order.id} status={order.status} />
      </div>

      {order.lot.description && (
        <div className="mt-8 text-sm text-paper/70">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-paper/60">
            Description
          </h2>
          <p>{order.lot.description}</p>
        </div>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid" || status === "shipped" || status === "delivered"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "refunded" || status === "cancelled"
        ? "bg-white/10 text-paper/60"
        : "bg-accent/20 text-accent";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
