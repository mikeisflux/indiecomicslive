import { prisma } from "@/lib/prisma";
import IpBlockForm from "./IpBlockForm";
import IpBlockRow from "./IpBlockRow";

export const dynamic = "force-dynamic";

export const metadata = { title: "IP blocklist — Admin" };

export default async function IpBlocksPage() {
  const blocks = await prisma.iPBlocklist.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">IP blocklist</h1>
      <IpBlockForm />
      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
            <tr>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {blocks.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-paper/50"
                >
                  No IPs blocked.
                </td>
              </tr>
            ) : (
              blocks.map((b) => (
                <IpBlockRow
                  key={b.id}
                  id={b.id}
                  ipAddress={b.ipAddress}
                  userId={b.userId}
                  reason={b.reason}
                  createdAt={b.createdAt.toISOString()}
                  expiresAt={b.expiresAt?.toISOString() ?? null}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
