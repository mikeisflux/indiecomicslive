import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin, logAudit } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Insurance claims — Admin",
  robots: { index: false, follow: false },
};

const FILTERS = [
  { v: "open", label: "Open" },
  { v: "approved", label: "Approved" },
  { v: "paid", label: "Paid" },
  { v: "denied", label: "Denied" },
  { v: "all", label: "All" },
] as const;

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminInsuranceClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/insurance-claims");
  const sp = (await searchParams) ?? {};
  const status =
    sp.status === "all"
      ? null
      : sp.status === "approved" ||
          sp.status === "denied" ||
          sp.status === "paid"
        ? sp.status
        : "open";

  const claims = await prisma.insuranceClaim.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      order: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          lot: { select: { title: true } },
        },
      },
      filedBy: { select: { id: true, name: true, handle: true, email: true } },
    },
  });

  async function decide(formData: FormData) {
    "use server";
    const me = await requireAdmin("/admin/insurance-claims");
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    const decisionNote = String(formData.get("note") ?? "").trim() || null;
    if (!id || !["approved", "denied", "paid"].includes(status)) return;
    await prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: status as "approved" | "denied" | "paid",
        decisionNote,
        decidedAt: new Date(),
        decidedById: me.id,
      },
    });
    await logAudit({
      actorId: me.id,
      action: "insurance.decide",
      targetKind: "insurance_claim",
      targetId: id,
      metadata: { status, decisionNote },
    });
    revalidatePath("/admin/insurance-claims");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Insurance claims</h1>
        <p className="text-sm text-paper/60">
          Buyer- or seller-filed claims against the platform for lost or
          damaged shipments. Approved + paid claims are settled out of
          rolling reserve.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5 text-sm">
        {FILTERS.map((f) => {
          const active = (status ?? "all") === f.v;
          return (
            <Link
              key={f.v}
              href={
                f.v === "open"
                  ? "/admin/insurance-claims"
                  : `/admin/insurance-claims?status=${f.v}`
              }
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-white/10 text-paper/60 hover:text-paper"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {claims.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
          Nothing here.
        </p>
      ) : (
        <ul className="space-y-3">
          {claims.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {c.reason.replace(/_/g, " ")} ·{" "}
                    <span className="font-mono">{dollars(c.amountCents)}</span>
                  </p>
                  <p className="text-xs text-paper/60">
                    Filed by{" "}
                    {c.filedBy.name ?? `@${c.filedBy.handle ?? "user"}`} ·{" "}
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-paper/80">
                    {c.description}
                  </p>
                  {c.order && (
                    <p className="mt-2 text-xs">
                      Order:{" "}
                      <Link
                        href={`/admin/orders/${c.order.id}`}
                        className="text-accent hover:underline"
                      >
                        {c.order.lot?.title ?? c.order.id.slice(0, 8)}
                      </Link>{" "}
                      · {dollars(c.order.amountCents)} · {c.order.status}
                    </p>
                  )}
                  {c.decisionNote && (
                    <p className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-paper/70">
                      <strong>Decision:</strong> {c.decisionNote}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    c.status === "open"
                      ? "bg-accent/20 text-accent"
                      : c.status === "approved"
                        ? "bg-amber-500/20 text-amber-300"
                        : c.status === "paid"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-paper/10 text-paper/60"
                  }`}
                >
                  {c.status}
                </span>
              </div>

              {c.status !== "paid" && c.status !== "denied" && (
                <form action={decide} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="Decision note (optional)"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    {c.status === "open" && (
                      <button
                        name="status"
                        value="approved"
                        className="rounded-full bg-amber-500/30 px-3 py-1 text-xs font-bold text-amber-200"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      name="status"
                      value="paid"
                      className="rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-200"
                    >
                      Mark paid
                    </button>
                    <button
                      name="status"
                      value="denied"
                      className="rounded-full border border-red-400/40 px-3 py-1 text-xs font-bold text-red-300"
                    >
                      Deny
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
