// Weekly seller payouts. Triggered by /api/cron/payouts on Thursdays
// (system cron hits the endpoint with Authorization: Bearer
// $CRON_SECRET). Eligibility:
//   - order.status in ['delivered'] (set by ShipStation cron / webhook)
//   - order.deliveredAt IS NOT NULL
//   - order.payoutId IS NULL  (not yet paid out)
//
// We group eligible orders by sellerId, compute net = gross - fee +
// shipping_reimbursement, and create one Payout row + one DivinityCoin
// payout per seller. Orders link back via Order.payoutId so we never
// double-pay.

import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

function bps(): number {
  const n = Number(process.env.PLATFORM_FEE_BPS ?? "1000");
  if (!Number.isFinite(n) || n < 0 || n > 10000) return 1000;
  return Math.round(n);
}

// Most recent Thursday at midnight UTC. The "weekEnding" anchor on a
// Payout row. Idempotent for the whole week — if we re-run the cron
// on Friday for the same Thursday it'll skip already-paid sellers.
function thursdayWeekEnding(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // 0 = Sunday, ... 4 = Thursday
  const dow = d.getUTCDay();
  const daysSinceThursday = (dow - 4 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceThursday);
  return d;
}

export interface PayoutSummary {
  sellerId: string;
  orderIds: string[];
  grossCents: number;
  feeCents: number;
  shippingCents: number;
  netCents: number;
}

export interface ProcessResult {
  weekEnding: string;
  attempted: number;
  paid: number;
  failed: number;
  details: Array<
    | { sellerId: string; status: "paid"; netCents: number; dcTransactionId: string }
    | { sellerId: string; status: "failed"; netCents: number; reason: string }
    | { sellerId: string; status: "skipped"; reason: string }
  >;
}

export async function processWeeklyPayouts(): Promise<ProcessResult> {
  const weekEnding = thursdayWeekEnding();
  const feeBps = bps();

  const eligible = await prisma.order.findMany({
    where: {
      status: "delivered",
      deliveredAt: { not: null },
      payoutId: null,
    },
    select: {
      id: true,
      sellerId: true,
      amountCents: true,
      shippingCostCents: true,
    },
  });

  // Group by seller
  const groups = new Map<string, PayoutSummary>();
  for (const o of eligible) {
    const ship = o.shippingCostCents ?? 0;
    const fee = Math.round((o.amountCents * feeBps) / 10000);
    const net = o.amountCents - fee + ship;
    const g = groups.get(o.sellerId) ?? {
      sellerId: o.sellerId,
      orderIds: [],
      grossCents: 0,
      feeCents: 0,
      shippingCents: 0,
      netCents: 0,
    };
    g.orderIds.push(o.id);
    g.grossCents += o.amountCents;
    g.feeCents += fee;
    g.shippingCents += ship;
    g.netCents += net;
    groups.set(o.sellerId, g);
  }

  const result: ProcessResult = {
    weekEnding: weekEnding.toISOString().slice(0, 10),
    attempted: groups.size,
    paid: 0,
    failed: 0,
    details: [],
  };

  for (const summary of groups.values()) {
    if (summary.netCents <= 0) {
      result.details.push({
        sellerId: summary.sellerId,
        status: "skipped",
        reason: "non_positive_net",
      });
      continue;
    }

    // Reserve a Payout row first so the orders are atomically tied to
    // it. If the DC dispatch fails we mark Payout.failed; we do NOT
    // free the orders, because that would let a retry double-pay if
    // DC actually succeeded but our response was lost.
    const payout = await prisma.payout.upsert({
      where: {
        sellerId_weekEnding: {
          sellerId: summary.sellerId,
          weekEnding,
        },
      },
      update: {},
      create: {
        sellerId: summary.sellerId,
        weekEnding,
        grossCents: summary.grossCents,
        feeCents: summary.feeCents,
        shippingCents: summary.shippingCents,
        netCents: summary.netCents,
        status: "processing",
      },
    });

    if (payout.status === "paid") {
      result.details.push({
        sellerId: summary.sellerId,
        status: "skipped",
        reason: "already_paid_this_week",
      });
      continue;
    }

    // Tie the orders to this payout (in case any are still loose).
    await prisma.order.updateMany({
      where: { id: { in: summary.orderIds }, payoutId: null },
      data: { payoutId: payout.id },
    });

    // Dispatch the DivinityCoin payout. The exact action name comes
    // from DC's partner docs — they implement seller payouts via a
    // bank transfer on a stored bank account. If DC's docs change the
    // action name, this is the one knob to turn.
    const dc = await callDivinityCoinAPI("create_payout", {
      seller_user_id: summary.sellerId,
      amount_cents: summary.netCents,
      currency: "usd",
      description: `Indie Comics Live weekly payout (week ending ${result.weekEnding})`,
      payout_reference: payout.id,
      metadata: {
        order_ids: summary.orderIds,
        gross_cents: summary.grossCents,
        fee_cents: summary.feeCents,
        shipping_cents: summary.shippingCents,
      },
    });

    if (dc.ok) {
      const txId =
        typeof dc.data.transaction_id === "string"
          ? dc.data.transaction_id
          : typeof dc.data.id === "string"
            ? dc.data.id
            : null;
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "paid",
          processedAt: new Date(),
          dcTransactionId: txId,
        },
      });
      result.paid += 1;
      result.details.push({
        sellerId: summary.sellerId,
        status: "paid",
        netCents: summary.netCents,
        dcTransactionId: txId ?? "(no_id)",
      });
    } else {
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "failed",
          processedAt: new Date(),
          failureReason: dc.error.slice(0, 500),
        },
      });
      result.failed += 1;
      result.details.push({
        sellerId: summary.sellerId,
        status: "failed",
        netCents: summary.netCents,
        reason: dc.error,
      });
    }
  }

  return result;
}
