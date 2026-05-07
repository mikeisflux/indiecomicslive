import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
});

// POST /api/seller/shipments
//
// Bundle one or more paid orders from the same buyer into a single
// Shipment so the seller can print one label for the whole batch
// (Whatnot-style). Validates:
//   - all orders belong to the current seller
//   - all orders share a buyer
//   - all orders are paid + not yet shipped + not yet bundled
//
// On success: a fresh Shipment row is created and every selected
// order is linked to it. The actual label-buying flow comes next —
// /seller/orders/[id]/buy-label can be extended to operate on a
// shipment id.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: parsed.data.orderIds } },
    select: {
      id: true,
      sellerId: true,
      buyerId: true,
      status: true,
      shipmentId: true,
      shippedAt: true,
    },
  });

  if (orders.length !== parsed.data.orderIds.length) {
    return NextResponse.json(
      { error: "missing_order", message: "One or more orders not found." },
      { status: 404 },
    );
  }
  for (const o of orders) {
    if (o.sellerId !== session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "An order in this bundle isn't yours." },
        { status: 403 },
      );
    }
    if (o.status !== "paid") {
      return NextResponse.json(
        {
          error: "not_paid",
          message: `Order ${o.id.slice(0, 8)}… is not paid.`,
        },
        { status: 400 },
      );
    }
    if (o.shipmentId) {
      return NextResponse.json(
        {
          error: "already_bundled",
          message: `Order ${o.id.slice(0, 8)}… is already in a shipment.`,
        },
        { status: 409 },
      );
    }
    if (o.shippedAt) {
      return NextResponse.json(
        { error: "already_shipped", message: "Already shipped." },
        { status: 409 },
      );
    }
  }
  const buyerIds = new Set(orders.map((o) => o.buyerId));
  if (buyerIds.size !== 1) {
    return NextResponse.json(
      {
        error: "mixed_buyers",
        message: "All orders in a bundle must be from the same buyer.",
      },
      { status: 400 },
    );
  }

  const buyerId = orders[0].buyerId;

  const shipment = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.create({
      data: { sellerId: session.user.id, buyerId },
    });
    // Race guard: shipmentId: null means a concurrent bundle that
    // beat us hasn't already linked these orders. count !== orderIds
    // length means at least one was claimed mid-transaction; bail.
    const linked = await tx.order.updateMany({
      where: {
        id: { in: parsed.data.orderIds },
        sellerId: session.user.id,
        shipmentId: null,
      },
      data: { shipmentId: s.id },
    });
    if (linked.count !== parsed.data.orderIds.length) {
      throw new Error("race_lost");
    }
    return s;
  }).catch((e: Error) => {
    if (e.message === "race_lost") return null;
    throw e;
  });

  if (!shipment) {
    return NextResponse.json(
      {
        error: "race_lost",
        message: "One of those orders just got bundled by another tab.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    shipmentId: shipment.id,
    orderCount: parsed.data.orderIds.length,
  });
}
