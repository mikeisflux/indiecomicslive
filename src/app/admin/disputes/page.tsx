import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Disputes — Admin",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-500/20 text-amber-300",
  under_review: "bg-sky-500/20 text-sky-300",
  resolved: "bg-emerald-500/20 text-emerald-300",
  closed_no_action: "bg-paper/10 text-paper/60",
};

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const filter = sp.status ?? "open";
  const where =
    filter === "all" ? {} : { status: filter as "open" | "under_review" | "resolved" | "closed_no_action" };

  const disputes = await prisma.orderDispute.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      openedBy: {
        select: { id: true, email: true, handle: true, name: true },
      },
      order: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          lot: { select: { title: true } },
          seller: { select: { id: true, handle: true, name: true } },
        },
      },
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Disputes</h1>
          <p className="mt-1 text-sm text-paper/60">
            Buyer-opened complaints. Resolve them here before they escalate to
            chargebacks.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {(["open", "under_review", "resolved", "closed_no_action", "all"] as const).map(
            (s) => (
              <Link
                key={s}
                href={`/admin/disputes?status=${s}`}
                className={`rounded-full px-3 py-1.5 ${
                  filter === s
                    ? "bg-accent text-white"
                    : "border border-white/10 text-paper/70"
                }`}
              >
                {s.replace(/_/g, " ")}
              </Link>
            ),
          )}
        </div>
      </div>

      {disputes.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          Nothing in this bucket.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {disputes.map((d) => {
            const tone = STATUS_TONE[d.status] ?? "bg-white/10 text-paper/70";
            return (
              <li key={d.id}>
                <Link
                  href={`/admin/disputes/${d.id}`}
                  className="block px-5 py-3 text-sm hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {d.order.lot.title ?? "(untitled lot)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-paper/60">
                        {d.reason.replace(/_/g, " ")} · buyer{" "}
                        {d.openedBy.email ?? d.openedBy.handle ?? "(unknown)"}{" "}
                        · seller @{d.order.seller.handle ?? "unknown"} · $
                        {(d.order.amountCents / 100).toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone}`}
                    >
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
