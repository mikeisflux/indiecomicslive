import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DisputeResolutionForm from "./DisputeResolutionForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispute — Admin",
  robots: { index: false, follow: false },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DisputeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await prisma.orderDispute.findUnique({
    where: { id },
    include: {
      openedBy: {
        select: { id: true, email: true, handle: true, name: true },
      },
      resolvedBy: {
        select: { id: true, email: true, name: true },
      },
      order: {
        include: {
          lot: { select: { title: true, imageUrl: true } },
          seller: { select: { id: true, email: true, handle: true, name: true } },
        },
      },
    },
  });
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/disputes"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Disputes
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {d.reason.replace(/_/g, " ")}
      </h1>
      <p className="mt-1 text-sm text-paper/60">
        Status: <span className="font-mono">{d.status}</span> · opened{" "}
        {new Date(d.createdAt).toLocaleString()}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-paper/50">Buyer</p>
          <p className="mt-1 font-semibold">
            {d.openedBy.name ?? d.openedBy.handle ?? d.openedBy.email}
          </p>
          <p className="text-xs text-paper/60">{d.openedBy.email}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-paper/50">Seller</p>
          <p className="mt-1 font-semibold">
            {d.order.seller.name ?? d.order.seller.handle ?? d.order.seller.email}
          </p>
          <p className="text-xs text-paper/60">{d.order.seller.email}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
        <p className="text-xs uppercase tracking-widest text-paper/50">Order</p>
        <p className="mt-1 font-semibold">
          {d.order.lot.title ?? "(untitled lot)"} —{" "}
          {dollars(d.order.amountCents)}
        </p>
        <p className="mt-1 text-xs text-paper/60">
          status: <span className="font-mono">{d.order.status}</span>{" "}
          {d.order.trackingNumber
            ? ` · tracking ${d.order.trackingNumber}`
            : ""}
        </p>
        <Link
          href={`/admin/orders/${d.order.id}`}
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Open admin order page →
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm">
        <p className="text-xs uppercase tracking-widest text-paper/50">
          What the buyer said
        </p>
        <p className="mt-2 whitespace-pre-wrap text-paper/90">{d.body}</p>
      </section>

      {d.resolution && (
        <section className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm">
          <p className="text-xs uppercase tracking-widest text-emerald-300">
            Resolution
          </p>
          <p className="mt-2 whitespace-pre-wrap text-paper/90">{d.resolution}</p>
          {d.resolvedAt && (
            <p className="mt-2 text-xs text-paper/50">
              Resolved {new Date(d.resolvedAt).toLocaleString()} by{" "}
              {d.resolvedBy?.email ?? "admin"}
            </p>
          )}
        </section>
      )}

      <div className="mt-6">
        <DisputeResolutionForm
          id={d.id}
          status={d.status}
          resolution={d.resolution}
        />
      </div>
    </div>
  );
}
