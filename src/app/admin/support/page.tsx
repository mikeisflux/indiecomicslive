import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Support — Admin",
  robots: { index: false, follow: false },
};

const FILTERS = [
  { v: "open", label: "Open" },
  { v: "awaiting_user", label: "Awaiting user" },
  { v: "resolved", label: "Resolved" },
  { v: "closed", label: "Closed" },
  { v: "all", label: "All" },
] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/support");
  const sp = (await searchParams) ?? {};
  const status =
    sp.status === "all"
      ? null
      : sp.status === "awaiting_user" ||
          sp.status === "resolved" ||
          sp.status === "closed"
        ? sp.status
        : "open";

  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, handle: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-paper/60">
          Buyer-filed tickets. Reply on a ticket to respond — the buyer
          gets the message in their /account/help thread.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5 text-sm">
        {FILTERS.map((f) => {
          const active = (status ?? "all") === f.v;
          return (
            <Link
              key={f.v}
              href={f.v === "open" ? "/admin/support" : `/admin/support?status=${f.v}`}
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

      {tickets.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
          Nothing to triage right now.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/support/${t.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    t.status === "resolved" || t.status === "closed"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : t.status === "awaiting_user"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-accent/20 text-accent"
                  }`}
                >
                  {t.status.replace("_", " ")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">
                    {t.subject}
                  </p>
                  <p className="text-xs text-paper/50">
                    {t.user.name ?? t.user.handle ?? t.user.email} ·{" "}
                    {t._count.messages} msg
                  </p>
                </div>
                <p className="shrink-0 text-xs text-paper/40">
                  {new Date(t.updatedAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
