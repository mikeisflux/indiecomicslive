import Link from "next/link";
import { requireOnboardedUser } from "@/lib/onboarding";
import { getSellerStats } from "@/lib/seller-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stats — Seller",
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function SellerStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const me = await requireOnboardedUser("/seller/stats");
  const sp = (await searchParams) ?? {};
  const days = Math.min(365, Math.max(7, Number(sp.days ?? "30") || 30));
  const stats = await getSellerStats(me.id, days);

  // Build a 7-day bucket sparkline that always covers the most recent
  // window so empty days don't disappear.
  const sparkBuckets: number[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const k = d.toISOString().slice(0, 10);
    const found = stats.recentDaily.find((b) => b.date === k);
    sparkBuckets.push(found?.grossCents ?? 0);
  }
  const sparkMax = Math.max(1, ...sparkBuckets);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Link
            href="/seller"
            className="text-sm text-paper/60 hover:text-paper"
          >
            ← Seller Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Stats</h1>
          <p className="mt-1 text-sm text-paper/60">
            Last {days} days. Refund-cancelled orders are excluded from totals.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/seller/stats?days=${d}`}
              className={`rounded-full px-3 py-1.5 ${
                d === days
                  ? "bg-accent text-white"
                  : "border border-white/10 text-paper/70"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Gross sales"
          value={dollars(stats.totals.grossCents)}
          sub={`${stats.totals.orders} orders`}
        />
        <Stat
          label="Platform fee"
          value={dollars(stats.totals.feeCents)}
          sub={`${(
            (stats.totals.grossCents
              ? stats.totals.feeCents / stats.totals.grossCents
              : 0) * 100
          ).toFixed(1)}% effective`}
        />
        <Stat
          label="Net (after fees)"
          value={dollars(stats.totals.netCents)}
          sub="Before processing pass-through"
        />
        <Stat
          label="Awaiting payout"
          value={dollars(stats.totals.awaitingPayoutCents)}
          sub="Delivered, not yet in a Thursday batch"
        />
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
          Last 7 days · gross
        </p>
        <div className="mt-3 flex items-end gap-1">
          {sparkBuckets.map((cents, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-accent/60"
                style={{
                  height: `${(cents / sparkMax) * 80 + 4}px`,
                }}
                title={dollars(cents)}
              />
              <span className="text-[10px] text-paper/40">
                {new Date(
                  today.getTime() - (6 - i) * 24 * 3600 * 1000,
                ).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Top lots
        </h2>
        {stats.topLots.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
            Nothing sold in this window yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
            {stats.topLots.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 px-5 py-3 text-sm"
              >
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-md bg-white/5" />
                )}
                <p className="min-w-0 flex-1 truncate font-medium">{l.title}</p>
                <span className="shrink-0 text-xs text-paper/60">
                  {l.orderCount}× · {dollars(l.grossCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-paper/70">
        <p>
          <strong className="text-paper">Pending ship:</strong>{" "}
          {dollars(stats.totals.pendingShipCents)}
          {" "}sitting in paid orders that haven&rsquo;t been shipped yet.
        </p>
        <p className="mt-1">
          <strong className="text-paper">Already paid out:</strong>{" "}
          {dollars(stats.totals.paidOutCents)}
          {" "}settled in past Thursday batches.
        </p>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-paper/50">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-paper/50">{sub}</p>
    </div>
  );
}
