import {
  getBlockedIPs,
  getRecentSuspiciousActivity,
} from "@/lib/bot-blocker";
import UnblockButton from "./UnblockButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bot blocker — Admin" };

export default async function BotBlockPage() {
  const [blocked, recent] = await Promise.all([
    getBlockedIPs(200).catch(() => []),
    getRecentSuspiciousActivity(100).catch(() => []),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Bot blocker</h1>
      <p className="mb-6 text-sm text-paper/60">
        Auto-banned IPs (3+ violations within an hour). The kernel
        firewall (iptables) drops these before they reach the app — these
        rows are the source of truth that the watcher sync reconciles
        against. For admin-issued bans, use{" "}
        <a className="text-accent" href="/admin/ip-blocks">
          IP blocklist
        </a>
        .
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
          Currently blocked ({blocked.length})
        </h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-paper/50">No active auto-bans.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
                <tr>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Violations</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {blocked.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs">
                      {b.ipAddress}
                    </td>
                    <td className="px-3 py-2 text-xs">{b.reason}</td>
                    <td className="px-3 py-2 text-xs">{b.violationCount}</td>
                    <td className="px-3 py-2 text-xs text-paper/60">
                      {new Date(b.blockedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-paper/60">
                      {new Date(b.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <UnblockButton ip={b.ipAddress} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
          Recent suspicious activity ({recent.length})
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-paper/50">Quiet for now.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-paper/60">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 text-xs text-paper/60">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.ipAddress}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.reason}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-paper/60">
                      {r.path ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-paper/50">
                      <span className="line-clamp-1">{r.userAgent ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
