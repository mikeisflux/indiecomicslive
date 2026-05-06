import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  reason: z.enum([
    "not_received",
    "not_as_described",
    "damaged",
    "wrong_item",
    "refund_requested",
    "other",
  ]),
  body: z.string().min(20).max(5000),
});

// POST /api/orders/[id]/dispute — buyer opens a dispute on the
// order. One dispute per order; re-POSTing on a row that already
// has a dispute returns the existing one (idempotent for retries).
//
// Allowed at any order status that has been paid (so a buyer can
// flag a problem mid-shipment, not only after delivery).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, buyerId: true, status: true },
    include: { dispute: { select: { id: true } } },
  });
  if (!order || order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    !["paid", "shipped", "delivered", "refunded"].includes(order.status)
  ) {
    return NextResponse.json(
      {
        error: "wrong_status",
        message: "Disputes are only valid on paid orders.",
      },
      { status: 409 },
    );
  }
  if (order.dispute) {
    return NextResponse.json({
      ok: true,
      id: order.dispute.id,
      alreadyOpen: true,
    });
  }

  const created = await prisma.orderDispute.create({
    data: {
      orderId: order.id,
      openedById: session.user.id,
      reason: parsed.data.reason,
      body: parsed.data.body,
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
