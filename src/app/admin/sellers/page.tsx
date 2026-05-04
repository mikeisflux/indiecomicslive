import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sellers — Admin" };

export default async function SellersList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; approved?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const approvedFilter = sp.approved ?? "all";

  const sellers = await prisma.seller.findMany({
    where: {
      ...(approvedFilter === "yes"
        ? { approved: true }
        : approvedFilter === "no"
          ? { approved: false }
          : {}),
      ...(q
        ? {
            OR: [
              { storeName: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { handle: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          handle: true,
          lockedAt: true,
          bannedAt: true,
          _count: { select: { shows: true, ordersAsSeller: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Sellers</h1>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search store / email / handle"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <select
            name="approved"
            defaultValue={approvedFilter}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="yes">Approved</option>
            <option value="no">Pending</option>
          </select>
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Apply
          </button>
        </form>
      </header>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
            <tr>
              <th className="px-3 py-2">Store</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Approved</th>
              <th className="px-3 py-2">Shows</th>
              <th className="px-3 py-2">Sold orders</th>
              <th className="px-3 py-2">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sellers.map((s) => (
              <tr key={s.userId} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/users/${s.userId}`}
                    className="block text-paper"
                  >
                    <p className="font-semibold">{s.storeName}</p>
                    <p className="line-clamp-1 text-xs text-paper/50">
                      {s.bio}
                    </p>
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">
                  <p>{s.user.email}</p>
                  <p className="text-paper/50">@{s.user.handle ?? "—"}</p>
                </td>
                <td className="px-3 py-3 text-xs">
                  {s.approved ? (
                    <span className="text-emerald-300/80">yes</span>
                  ) : (
                    <span className="text-amber-300">no</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">{s.user._count.shows}</td>
                <td className="px-3 py-3 text-xs">
                  {s.user._count.ordersAsSeller}
                </td>
                <td className="px-3 py-3 text-xs">
                  {s.user.bannedAt
                    ? "banned"
                    : s.user.lockedAt
                      ? "locked"
                      : "active"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
