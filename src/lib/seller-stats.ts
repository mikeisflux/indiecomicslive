import { prisma } from "@/lib/prisma";

// Seller stats helper: aggregates a seller's order data for the
// stats page (and any future API). Cheap enough to compute on each
// page request — no caching layer.

export interface DailyBucket {
  date: string; // YYYY-MM-DD in seller's local time (UTC for now)
  grossCents: number;
  feeCents: number;
  netCents: number;
  orderCount: number;
}

export interface TopLot {
  id: string;
  title: string;
  imageUrl: string | null;
  grossCents: number;
  orderCount: number;
}

export interface SellerStats {
  windowDays: number;
  totals: {
    orders: number;
    grossCents: number;
    feeCents: number;
    netCents: number;
    paidOutCents: number;
    awaitingPayoutCents: number; // delivered but not yet in a payout
    pendingShipCents: number; // paid but not shipped
  };
  topLots: TopLot[];
  recentDaily: DailyBucket[];
}

const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? "600");

function feeCentsFor(grossCents: number): number {
  return Math.floor((grossCents * PLATFORM_FEE_BPS) / 10_000);
}

function dayKey(d: Date): string {
  // YYYY-MM-DD in UTC. Future: per-seller TZ from User.timezone.
  return d.toISOString().slice(0, 10);
}

export async function getSellerStats(
  sellerId: string,
  windowDays = 30,
): Promise<SellerStats> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      paidAt: { not: null, gte: cutoff },
      status: { in: ["paid", "shipped", "delivered", "refunded"] },
    },
    select: {
      id: true,
      lotId: true,
      amountCents: true,
      status: true,
      paidAt: true,
      shippedAt: true,
      deliveredAt: true,
      payoutId: true,
      lot: { select: { id: true, title: true, imageUrl: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 2000,
  });

  let grossCents = 0;
  let feeCents = 0;
  let netCents = 0;
  let paidOutCents = 0;
  let awaitingPayoutCents = 0;
  let pendingShipCents = 0;

  const dailyMap = new Map<string, DailyBucket>();
  const lotMap = new Map<string, TopLot>();

  for (const o of orders) {
    if (o.status === "refunded") {
      // Refunds zero out gross / fee but leave the order visible.
      continue;
    }
    grossCents += o.amountCents;
    const fee = feeCentsFor(o.amountCents);
    feeCents += fee;
    const net = o.amountCents - fee;
    netCents += net;

    if (o.payoutId) {
      paidOutCents += net;
    } else if (o.deliveredAt) {
      awaitingPayoutCents += net;
    } else if (!o.shippedAt) {
      pendingShipCents += o.amountCents;
    }

    const k = dayKey(o.paidAt!);
    const bucket =
      dailyMap.get(k) ??
      {
        date: k,
        grossCents: 0,
        feeCents: 0,
        netCents: 0,
        orderCount: 0,
      };
    bucket.grossCents += o.amountCents;
    bucket.feeCents += fee;
    bucket.netCents += net;
    bucket.orderCount += 1;
    dailyMap.set(k, bucket);

    const lotKey = o.lot.id;
    const lot =
      lotMap.get(lotKey) ??
      {
        id: lotKey,
        title: o.lot.title,
        imageUrl: o.lot.imageUrl,
        grossCents: 0,
        orderCount: 0,
      };
    lot.grossCents += o.amountCents;
    lot.orderCount += 1;
    lotMap.set(lotKey, lot);
  }

  const recentDaily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const topLots = Array.from(lotMap.values())
    .sort((a, b) => b.grossCents - a.grossCents)
    .slice(0, 8);

  return {
    windowDays,
    totals: {
      orders: orders.filter((o) => o.status !== "refunded").length,
      grossCents,
      feeCents,
      netCents,
      paidOutCents,
      awaitingPayoutCents,
      pendingShipCents,
    },
    topLots,
    recentDaily,
  };
}
