import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

const Body = z.object({
  setupIntentId: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const lookup = await callDivinityCoinAPI("lookup-payment-method", {
    platformUserId: session.user.id,
    setupIntentId: parsed.data.setupIntentId,
    paymentMethodId: parsed.data.paymentMethodId,
  });
  const card: Record<string, unknown> | undefined =
    lookup.ok && lookup.data.card && typeof lookup.data.card === "object"
      ? (lookup.data.card as Record<string, unknown>)
      : undefined;
  const brand =
    card && typeof card.brand === "string" ? (card.brand as string) : null;
  const last4 =
    card && typeof card.last4 === "string" ? (card.last4 as string) : null;
  const expMonth =
    card && typeof card.exp_month === "number"
      ? (card.exp_month as number)
      : null;
  const expYear =
    card && typeof card.exp_year === "number"
      ? (card.exp_year as number)
      : null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.userPaymentMethod.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
    return tx.userPaymentMethod.create({
      data: {
        userId: session.user.id,
        processor: "divinitycoin",
        vaultId: parsed.data.paymentMethodId,
        cardBrand: brand,
        cardLast4: last4,
        cardExpMonth: expMonth,
        cardExpYear: expYear,
        isDefault: true,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    method: {
      id: row.id,
      cardBrand: row.cardBrand,
      cardLast4: row.cardLast4,
      cardExpMonth: row.cardExpMonth,
      cardExpYear: row.cardExpYear,
      isDefault: row.isDefault,
    },
  });
}
