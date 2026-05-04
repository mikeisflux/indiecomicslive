import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Audit log — Admin" };

export default async function AuditLog({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    target?: string;
    action?: string;
  }>;
}) {
  const sp = await searchParams;
  const where = {
    ...(sp.actor ? { actorId: sp.actor } : {}),
    ...(sp.target ? { targetId: sp.target } : {}),
    ...(sp.action ? { action: { contains: sp.action } } : {}),
  };

  const [logs, actorIds] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditLog
      .findMany({
        where,
        select: { actorId: true },
        distinct: ["actorId"],
        take: 200,
      })
      .then((rows) => rows.map((r) => r.actorId)),
  ]);

  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true, handle: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <form className="flex items-center gap-2">
          <input
            name="action"
            defaultValue={sp.action ?? ""}
            placeholder="action contains…"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
          />
          <input
            name="actor"
            defaultValue={sp.actor ?? ""}
            placeholder="actor id"
            className="w-48 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-mono text-xs"
          />
          <input
            name="target"
            defaultValue={sp.target ?? ""}
            placeholder="target id"
            className="w-48 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-mono text-xs"
          />
          <button className="rounded-full border border-white/10 px-3 py-1.5 text-xs">
            Filter
          </button>
        </form>
      </header>

      {logs.length === 0 ? (
        <p className="text-paper/50">Nothing matches.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((l) => {
                const actor = actorMap.get(l.actorId);
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-3 py-2 text-xs text-paper/60">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {actor ? (
                        <Link
                          href={`/admin/users/${actor.id}`}
                          className="hover:underline"
                        >
                          @{actor.handle ?? actor.email}
                        </Link>
                      ) : (
                        <span className="font-mono text-[10px]">
                          {l.actorId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {l.action}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-paper/60">
                      {l.targetKind && l.targetId ? (
                        <Link
                          href={targetUrl(l.targetKind, l.targetId)}
                          className="hover:underline"
                        >
                          {l.targetKind}/{l.targetId.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-paper/50">
                      {l.metadata
                        ? JSON.stringify(l.metadata).slice(0, 200)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function targetUrl(kind: string, id: string) {
  switch (kind) {
    case "user":
      return `/admin/users/${id}`;
    case "order":
      return `/admin/orders/${id}`;
    case "seller_application":
      return `/admin/seller-applications/${id}`;
    default:
      return "#";
  }
}
