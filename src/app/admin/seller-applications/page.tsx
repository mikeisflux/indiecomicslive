import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { SellerApplicationStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller applications — Admin",
};

const STATUS_TABS: { key: SellerApplicationStatus | "all"; label: string }[] = [
  { key: "submitted", label: "Pending" },
  { key: "under_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function SellerApplicationsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.status ?? "submitted") as
    | SellerApplicationStatus
    | "all";
  const q = sp.q?.trim() ?? "";

  const apps = await prisma.sellerApplication.findMany({
    where: {
      ...(filter !== "all" ? { status: filter } : {}),
      ...(q
        ? {
            OR: [
              { storeName: { contains: q, mode: "insensitive" } },
              { legalFirstName: { contains: q, mode: "insensitive" } },
              { legalLastName: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { handle: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { email: true, handle: true } },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    take: 200,
  });

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Seller applications</h1>
        <form className="flex items-center gap-2">
          <input type="hidden" name="status" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search store / email / handle"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Search
          </button>
        </form>
      </header>

      <nav className="mb-4 flex gap-2 text-xs">
        {STATUS_TABS.map((t) => {
          const url = `/admin/seller-applications?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={t.key}
              href={url}
              className={`rounded-full px-3 py-1 ${
                filter === t.key
                  ? "bg-accent text-white"
                  : "border border-white/10 text-paper/70"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {apps.length === 0 ? (
        <p className="text-paper/50">No applications match.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
              <tr>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Applicant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">NSFW</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/seller-applications/${a.id}`}
                      className="block"
                    >
                      <p className="font-semibold">{a.storeName}</p>
                      <p className="text-xs text-paper/50">
                        {a.legalFirstName} {a.legalLastName}
                      </p>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <p>{a.user.email}</p>
                    <p className="text-paper/50">@{a.user.handle ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-paper/70">
                    {a.willListAdult ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 text-xs text-paper/60">
                    {a.submittedAt
                      ? new Date(a.submittedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "rejected"
        ? "bg-red-500/20 text-red-300"
        : status === "under_review"
          ? "bg-amber-500/20 text-amber-300"
          : "bg-accent/20 text-accent";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
