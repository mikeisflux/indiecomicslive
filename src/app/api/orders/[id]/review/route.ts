import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/orders/[id]/review — leave or update a 1-5 star review
// for the seller of this order. Only the buyer can write it; only
// allowed once the order is delivered (so reviews are anchored in
// real, completed transactions). Idempotent: re-POSTing updates the
// existing row instead of creating a duplicate.
const Body = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

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
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, buyerId: true, sellerId: true, status: true, deliveredAt: true },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!order.deliveredAt && order.status !== "delivered") {
    return NextResponse.json(
      {
        error: "not_delivered",
        message: "You can leave a review once the order is delivered.",
      },
      { status: 409 },
    );
  }

  const review = await prisma.review.upsert({
    where: { orderId: order.id },
    update: {
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
    create: {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    review: {
      id: review.id,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    },
  });
}
