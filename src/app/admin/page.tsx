import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Admin",
};

async function metrics() {
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [
    pendingApps,
    liveShows,
    activeUsers,
    bannedUsers,
    pendingOrders,
    paidOrders24h,
    paidOrders7d,
    refundedOrders7d,
    chargebackCancelled7d,
    gmv24hSum,
    gmv7dSum,
    totalSellers,
  ] = await Promise.all([
    prisma.sellerApplication.count({ where: { status: "submitted" } }),
    prisma.show.count({ where: { status: "live" } }),
    prisma.user.count({ where: { deletedAt: null, accountDeletedAt: null } }),
    prisma.user.count({ where: { lockedAt: { not: null } } }),
    prisma.order.count({ where: { status: "pending_payment" } }),
    prisma.order.count({ where: { status: "paid", paidAt: { gte: since24h } } }),
    prisma.order.count({ where: { status: "paid", paidAt: { gte: since7d } } }),
    prisma.order.count({
      where: { status: "refunded", createdAt: { gte: since7d } },
    }),
    prisma.order.count({
      where: { status: "cancelled", createdAt: { gte: since7d } },
    }),
    prisma.order.aggregate({
      where: { status: "paid", paidAt: { gte: since24h } },
      _sum: { amountCents: true },
    }),
    prisma.order.aggregate({
      where: { status: "paid", paidAt: { gte: since7d } },
      _sum: { amountCents: true },
    }),
    prisma.seller.count({ where: { approved: true } }),
  ]);

  return {
    pendingApps,
    liveShows,
    activeUsers,
    bannedUsers,
    pendingOrders,
    paidOrders24h,
    paidOrders7d,
    refundedOrders7d,
    chargebackCancelled7d,
    gmv24hCents: gmv24hSum._sum.amountCents ?? 0,
    gmv7dCents: gmv7dSum._sum.amountCents ?? 0,
    totalSellers,
  };
}

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminHome() {
  const m = await metrics();

  const cards: {
    label: string;
    value: string | number;
    href?: string;
    tone?: "default" | "warn" | "good";
  }[] = [
    {
      label: "Pending applications",
      value: m.pendingApps,
      href: "/admin/seller-applications?status=submitted",
      tone: m.pendingApps > 0 ? "warn" : "default",
    },
    {
      label: "Live shows",
      value: m.liveShows,
      href: "/admin/shows?status=live",
      tone: "good",
    },
    {
      label: "Approved sellers",
      value: m.totalSellers,
      href: "/admin/sellers",
    },
    {
      label: "Active users",
      value: m.activeUsers,
      href: "/admin/users",
    },
    {
      label: "Pending orders",
      value: m.pendingOrders,
      href: "/admin/orders?status=pending_payment",
      tone: m.pendingOrders > 5 ? "warn" : "default",
    },
    {
      label: "Banned / locked users",
      value: m.bannedUsers,
      href: "/admin/users?locked=1",
    },
    {
      label: "GMV last 24h",
      value: dollars(m.gmv24hCents),
    },
    {
      label: "Paid orders / 24h",
      value: m.paidOrders24h,
    },
    {
      label: "GMV last 7d",
      value: dollars(m.gmv7dCents),
    },
    {
      label: "Paid orders / 7d",
      value: m.paidOrders7d,
    },
    {
      label: "Refunds / 7d",
      value: m.refundedOrders7d,
      tone: m.refundedOrders7d > 5 ? "warn" : "default",
    },
    {
      label: "Chargebacks / 7d",
      value: m.chargebackCancelled7d,
      href: "/admin/chargebacks",
      tone: m.chargebackCancelled7d > 0 ? "warn" : "default",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const tone =
            c.tone === "warn"
              ? "border-accent/40 bg-accent/5"
              : c.tone === "good"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-white/10 bg-white/[0.02]";
          const Inner = (
            <div className={`rounded-2xl border p-4 ${tone}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
                {c.label}
              </p>
              <p className="mt-2 text-2xl font-bold">{c.value}</p>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>
              {Inner}
            </Link>
          ) : (
            <div key={c.label}>{Inner}</div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-widest text-paper/60">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/seller-applications?status=submitted"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20"
        >
          <p className="font-semibold">Review pending sellers</p>
          <p className="mt-1 text-xs text-paper/60">
            {m.pendingApps} applications waiting on you.
          </p>
        </Link>
        <Link
          href="/admin/orders?status=pending_payment"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20"
        >
          <p className="font-semibold">Stuck orders</p>
          <p className="mt-1 text-xs text-paper/60">
            Auctions that ended but haven&rsquo;t been paid yet.
          </p>
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20"
        >
          <p className="font-semibold">Recent admin actions</p>
          <p className="mt-1 text-xs text-paper/60">
            Audit log — who did what, when.
          </p>
        </Link>
      </div>
    </div>
  );
}
