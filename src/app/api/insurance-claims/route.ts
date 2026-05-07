import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/insurance-claims — file a claim against the platform for
// a lost / damaged shipment. Either the buyer or the seller of the
// order can file. Status starts at "open"; admin reviews via
// /admin/insurance-claims and the rolling-reserve handles payout.
const Body = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    "damaged_in_transit",
    "lost_in_transit",
    "carrier_loss",
    "porch_theft",
    "other",
  ]),
  description: z.string().min(20).max(5000),
  amountCents: z.number().int().min(100).max(10_000_000),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
    where: { id: parsed.data.orderId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      amountCents: true,
      status: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const allowed =
    order.buyerId === session.user.id ||
    order.sellerId === session.user.id;
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Cap claim amount at the order total to keep abuse honest.
  const cappedAmount = Math.min(parsed.data.amountCents, order.amountCents);

  // Race-safe: serializable transaction. The findFirst + create lives
  // inside one tx so a concurrent caller sees either the row we just
  // inserted (and returns 409) or blocks until commit.
  const claim = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.insuranceClaim.findFirst({
        where: { orderId: order.id, status: { in: ["open", "approved"] } },
        select: { id: true },
      });
      if (existing) return null;
      return tx.insuranceClaim.create({
        data: {
          orderId: order.id,
          filedById: session.user.id,
          reason: parsed.data.reason,
          description: parsed.data.description,
          amountCents: cappedAmount,
          evidenceUrls: parsed.data.evidenceUrls ?? [],
        },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
  if (!claim) {
    return NextResponse.json(
      {
        error: "already_open",
        message: "There's already an active claim on this order.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: claim.id });
}
