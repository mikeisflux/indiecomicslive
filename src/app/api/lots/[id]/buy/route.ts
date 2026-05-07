import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeOrder } from "@/lib/payments";

export const runtime = "nodejs";

// POST /api/lots/[id]/buy
//
// Single-action purchase for a Buy-Now / Mystery / pack_break lot.
// Body: { quantity?: number }. Default 1. quantity > 1 only valid for
// pack_break — each spot becomes its own Order so the seller can pull
// per spot on stream and ship per spot.
//
// Each spot atomically decrements inventory + creates a pending
// Order, then charges via chargeOrder(). Charge failures roll back
// inventory + mark the order payment_failed and stop processing
// further spots — partial success returns the orderIds that DID
// charge so the buyer ends up with N consistent orders.
const Body = z
  .object({
    quantity: z.number().int().min(1).max(32).optional(),
  })
  .partial();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: lotId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const requestedQty = parsed.data.quantity ?? 1;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      kind: true,
      buyNowCents: true,
      inventoryCount: true,
      sellerId: true,
      showId: true,
      title: true,
      shippingCostCents: true,
    },
  });
  if (!lot) {
    return NextResponse.json({ error: "lot_not_found" }, { status: 404 });
  }
  if (lot.kind === "auction") {
    return NextResponse.json(
      {
        error: "auction_lot",
        message: "This lot is auction-only — place a bid.",
      },
      { status: 400 },
    );
  }
  if (!lot.buyNowCents || lot.buyNowCents <= 0) {
    return NextResponse.json(
      { error: "no_price", message: "This lot is missing its Buy-Now price." },
      { status: 400 },
    );
  }
  if (lot.inventoryCount <= 0) {
    return NextResponse.json(
      { error: "sold_out", message: "Sold out." },
      { status: 409 },
    );
  }
  if (!lot.sellerId) {
    return NextResponse.json(
      { error: "no_seller", message: "Lot has no seller record." },
      { status: 500 },
    );
  }
  if (lot.sellerId === session.user.id) {
    return NextResponse.json(
      { error: "self_purchase", message: "You can't buy your own lot." },
      { status: 400 },
    );
  }

  if (requestedQty > 1 && lot.kind !== "pack_break") {
    return NextResponse.json(
      {
        error: "single_only",
        message: "Only pack-break lots support multi-quantity claims.",
      },
      { status: 400 },
    );
  }
  const qty =
    lot.kind === "pack_break"
      ? Math.min(requestedQty, lot.inventoryCount)
      : 1;
  if (qty <= 0) {
    return NextResponse.json(
      { error: "sold_out", message: "Sold out." },
      { status: 409 },
    );
  }

  const orderIds: string[] = [];
  const failures: { reason: string }[] = [];

  for (let i = 0; i < qty; i++) {
    const order = await prisma
      .$transaction(async (tx) => {
        const updated = await tx.lot.updateMany({
          where: { id: lotId, inventoryCount: { gt: 0 } },
          data: { inventoryCount: { decrement: 1 } },
        });
        if (updated.count === 0) {
          throw new Error("sold_out");
        }
        const remaining = await tx.lot.findUnique({
          where: { id: lotId },
          select: { inventoryCount: true },
        });
        if ((remaining?.inventoryCount ?? 0) <= 0) {
          await tx.lot.update({
            where: { id: lotId },
            data: { status: "sold", soldAt: new Date() },
          });
        }
        const shipping = lot.shippingCostCents ?? 0;
        return tx.order.create({
          data: {
            lotId,
            buyerId: session.user.id,
            sellerId: lot.sellerId!,
            amountCents: lot.buyNowCents! + shipping,
            shippingCents: shipping,
            status: "pending_payment",
          },
        });
      })
      .catch((e: Error) => {
        if (e.message === "sold_out") return null;
        throw e;
      });

    if (!order) {
      failures.push({ reason: "sold_out" });
      break;
    }

    const charge = await chargeOrder(order.id);
    if (!charge.ok) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { status: "payment_failed" },
        }),
        prisma.lot.update({
          where: { id: lotId },
          data: { inventoryCount: { increment: 1 } },
        }),
      ]);
      failures.push({ reason: charge.reason });
      break;
    }
    orderIds.push(order.id);
  }

  if (orderIds.length === 0) {
    const reason = failures[0]?.reason ?? "unknown";
    return NextResponse.json(
      { error: "charge_failed", message: reason },
      { status: 402 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId: orderIds[0],
    orderIds,
    requested: qty,
    fulfilled: orderIds.length,
    failures,
  });
}
