import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import ShipForm from "./ShipForm";
import InsuranceClaimForm from "@/components/InsuranceClaimForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order — Seller",
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function SellerOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireOnboardedUser(`/seller/orders/${id}`);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lot: { select: { id: true, title: true } },
      buyer: { select: { name: true, email: true, handle: true } },
      insuranceClaims: {
        where: { status: { in: ["open", "approved"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!order || order.sellerId !== me.id) notFound();

  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { shipFromAddress: true },
  });
  const shipFromAddress = (meRow?.shipFromAddress ?? null) as
    | Record<string, string>
    | null;
  const hasShipFrom =
    !!shipFromAddress?.street1 && !!shipFromAddress.city && !!shipFromAddress.postalCode;

  // Buyer's shipping address is stored as a single text field on the
  // order. We parse loosely; we'd much rather upgrade this to a JSON
  // address but that's its own migration.
  const shipTo = order.shippingAddress?.trim() ?? "";

  const labelUrl = order.labelR2Key
    ? `/api/seller/orders/${order.id}/label.pdf`
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <Link href="/seller/orders" className="text-sm text-paper/60 hover:text-paper">
        ← Seller Orders
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{order.lot.title || "(untitled lot)"}</h1>
      <p className="mt-1 text-sm text-paper/60">
        {dollars(order.amountCents)} · status {order.status}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-paper/50">Buyer</p>
          <p className="mt-1 font-semibold">
            {order.buyer.name ?? order.buyer.handle ?? "(no name)"}
          </p>
          <p className="text-xs text-paper/60">{order.buyer.email}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-paper/50">Ship to</p>
          <pre className="mt-1 whitespace-pre-wrap text-paper/90">
            {shipTo || "(no address on file)"}
          </pre>
        </div>
      </div>

      {order.trackingNumber && (
        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-emerald-300">Tracking</p>
          <p className="mt-1 font-mono">{order.trackingNumber}</p>
          <p className="mt-1 text-xs text-paper/60">
            {order.shippingCarrier} · {order.shippingService} ·{" "}
            {order.shippingCostCents !== null && order.shippingCostCents !== undefined
              ? dollars(order.shippingCostCents)
              : "—"}
            {order.shippedAt
              ? ` · shipped ${new Date(order.shippedAt).toLocaleString()}`
              : ""}
            {order.deliveredAt
              ? ` · delivered ${new Date(order.deliveredAt).toLocaleString()}`
              : ""}
          </p>
          {labelUrl && (
            <a
              href={labelUrl}
              className="mt-3 inline-block rounded-full border border-white/15 px-3 py-1 text-xs"
            >
              Re-print label
            </a>
          )}
        </div>
      )}

      {(order.shippedAt || order.status === "delivered") && (
        <section className="mt-6">
          <InsuranceClaimForm
            orderId={order.id}
            maxAmountCents={order.amountCents}
            alreadyOpen={order.insuranceClaims.length > 0}
          />
        </section>
      )}

      {!order.trackingNumber && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
            Print shipping label
          </h2>
          {!hasShipFrom ? (
            <p className="mt-3 text-sm text-paper/60">
              You need a return address on file before you can buy a label.{" "}
              <Link href="/seller/ship-from" className="text-accent hover:underline">
                Set return address →
              </Link>
            </p>
          ) : !shipTo ? (
            <p className="mt-3 text-sm text-paper/60">
              No buyer shipping address on the order. Ask the buyer to update
              theirs from <code>/account</code>.
            </p>
          ) : (
            <ShipForm orderId={order.id} />
          )}
        </section>
      )}
    </main>
  );
}
