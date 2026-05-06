import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeOrder } from "@/lib/payments";

export const runtime = "nodejs";

// POST /api/lots/[id]/buy
//
// Single-action purchase for a Buy-Now (or Mystery) lot. Creates a
// pending Order, decrements lot inventory, charges the buyer's
// default saved payment method via the existing chargeOrder() flow,
// and returns the resulting order id. Auction lots are rejected —
// they go through the bid → win path instead.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: lotId } = await params;

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
      { error: "auction_lot", message: "This lot is auction-only — place a bid." },
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

  // Atomic: decrement inventory only if positive, then create the order.
  // Mark the lot 'sold' when the last unit is gone.
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.lot.updateMany({
      where: { id: lotId, inventoryCount: { gt: 0 } },
      data: {
        inventoryCount: { decrement: 1 },
      },
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
  }).catch((e: Error) => {
    if (e.message === "sold_out") return null;
    throw e;
  });

  if (!order) {
    return NextResponse.json(
      { error: "sold_out", message: "Sold out." },
      { status: 409 },
    );
  }

  const charge = await chargeOrder(order.id);
  if (!charge.ok) {
    // Revert inventory + delete the dangling order so the buyer can
    // try again with a different card.
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
    return NextResponse.json(
      { error: "charge_failed", message: charge.reason, orderId: order.id },
      { status: 402 },
    );
  }

  return NextResponse.json({ ok: true, orderId: order.id });
}
