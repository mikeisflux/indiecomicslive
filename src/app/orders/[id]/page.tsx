import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import OrderActions from "./OrderActions";
import ReviewForm from "./ReviewForm";

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
      lot: {
        select: {
          title: true,
          imageUrl: true,
          description: true,
          kind: true,
          mysteryContentsHtml: true,
          mysteryItemCount: true,
          images: {
            orderBy: { position: "asc" },
            select: { id: true, url: true },
          },
        },
      },
      seller: { select: { handle: true, name: true } },
      review: { select: { rating: true, body: true } },
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={order.lot.imageUrl}
          alt={order.lot.title}
          className="mb-3 w-full rounded-2xl object-cover"
        />
      )}
      {order.lot.images.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {order.lot.images.map((img) => (
            <a
              key={img.id}
              href={img.url}
              target="_blank"
              rel="noreferrer"
              className="block shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="h-20 w-20 rounded-lg border border-white/10 object-cover hover:border-white/30"
              />
            </a>
          ))}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        {order.shippingCents > 0 && (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-paper/60">Item</span>
              <span>${((order.amountCents - order.shippingCents) / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-paper/60">Shipping</span>
              <span>${(order.shippingCents / 100).toFixed(2)}</span>
            </div>
          </>
        )}
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

      {(order.deliveredAt || order.status === "delivered") && (
        <div className="mt-8">
          <ReviewForm orderId={order.id} initial={order.review} />
        </div>
      )}

      {order.lot.kind === "mystery" &&
        ["paid", "shipped", "delivered"].includes(order.status) && (
          <div className="mt-8 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-300">
              Mystery box reveal
              {order.lot.mysteryItemCount
                ? ` · ${order.lot.mysteryItemCount} items`
                : ""}
            </p>
            {order.lot.mysteryContentsHtml ? (
              <div
                className="prose prose-invert mt-3 max-w-none text-sm"
                dangerouslySetInnerHTML={{
                  __html: order.lot.mysteryContentsHtml,
                }}
              />
            ) : (
              <p className="mt-2 text-paper/60">
                The seller hasn&rsquo;t set the contents yet. They&rsquo;ll
                show here once the package is on the way.
              </p>
            )}
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
