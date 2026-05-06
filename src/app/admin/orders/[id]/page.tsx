import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Order — Admin" };

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, email: true, handle: true } },
      seller: { select: { id: true, email: true, handle: true } },
      lot: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          showId: true,
          show: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-paper/60">
        ← Orders
      </Link>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{order.lot.title}</h1>
          <p className="text-sm text-paper/60">
            {order.lot.show ? (
              <>
                From show:{" "}
                <Link
                  href={`/admin/shows?status=all&q=${encodeURIComponent(order.lot.show.title)}`}
                  className="text-accent"
                >
                  {order.lot.show.title}
                </Link>
              </>
            ) : (
              <>From 24/7 shop</>
            )}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest">
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Parties">
          <Field
            label="Buyer"
            value={
              <Link
                href={`/admin/users/${order.buyer.id}`}
                className="text-accent"
              >
                @{order.buyer.handle ?? order.buyer.email}
              </Link>
            }
          />
          <Field
            label="Seller"
            value={
              <Link
                href={`/admin/users/${order.seller.id}`}
                className="text-accent"
              >
                @{order.seller.handle ?? order.seller.email}
              </Link>
            }
          />
        </Section>

        <Section title="Money">
          <Field label="Amount" value={dollars(order.amountCents)} />
          <Field label="Status" value={order.status.replace(/_/g, " ")} />
          <Field
            label="Processor"
            value={order.paymentProcessor ?? "—"}
          />
          <Field
            label="Vault id"
            value={
              <span className="font-mono text-xs">
                {order.nmiCustomerVaultId ?? "—"}
              </span>
            }
          />
          <Field
            label="Transaction id"
            value={
              <span className="font-mono text-xs">
                {order.nmiTransactionId ?? "—"}
              </span>
            }
          />
          {order.paidAt && (
            <Field
              label="Paid at"
              value={new Date(order.paidAt).toLocaleString()}
            />
          )}
        </Section>

        <Section title="Fulfillment">
          <Field
            label="Shipping address"
            value={order.shippingAddress ?? "—"}
          />
          <Field
            label="Tracking number"
            value={order.trackingNumber ?? "—"}
          />
        </Section>

        <Section title="Created">
          <Field
            label="Created at"
            value={new Date(order.createdAt).toLocaleString()}
          />
          <Field
            label="Order id"
            value={<span className="font-mono text-xs">{order.id}</span>}
          />
        </Section>
      </div>

      <div className="mt-8">
        <OrderActions
          orderId={order.id}
          status={order.status}
          amountCents={order.amountCents}
          hasTransaction={!!order.nmiTransactionId}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-paper/60">
        {title}
      </h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-xs text-paper/50">{label}</span>
      <span className="text-paper/90">{value}</span>
    </div>
  );
}
