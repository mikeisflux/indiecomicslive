import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { ShowStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shows — Admin" };

const TABS: (ShowStatus | "all")[] = [
  "live",
  "scheduled",
  "ended",
  "cancelled",
  "all",
];

export default async function ShowsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status ?? "live") as ShowStatus | "all";
  const q = sp.q?.trim() ?? "";

  const shows = await prisma.show.findMany({
    where: {
      ...(status !== "all" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { seller: { handle: { contains: q, mode: "insensitive" } } },
              { seller: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      seller: { select: { id: true, handle: true, email: true } },
      _count: { select: { lots: true } },
    },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Shows</h1>
        <form className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title / seller"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Search
          </button>
        </form>
      </header>

      <nav className="mb-4 flex gap-2 text-xs">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/shows?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1 ${
              status === s
                ? "bg-accent text-white"
                : "border border-white/10 text-paper/70"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
            <tr>
              <th className="px-3 py-2">Show</th>
              <th className="px-3 py-2">Seller</th>
              <th className="px-3 py-2">Lots</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {shows.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-paper/50">
                    Stream: {s.streamId ?? "—"}
                  </p>
                </td>
                <td className="px-3 py-3 text-xs">
                  <Link
                    href={`/admin/users/${s.seller.id}`}
                    className="hover:underline"
                  >
                    @{s.seller.handle ?? s.seller.email}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs">{s._count.lots}</td>
                <td className="px-3 py-3 text-xs capitalize">{s.status}</td>
                <td className="px-3 py-3 text-xs text-paper/60">
                  {s.startedAt
                    ? new Date(s.startedAt).toLocaleString()
                    : s.scheduledFor
                      ? `scheduled ${new Date(s.scheduledFor).toLocaleString()}`
                      : "—"}
                </td>
                <td className="px-3 py-3 text-xs">
                  <Link
                    href={`/s/${s.id}`}
                    className="text-accent hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
