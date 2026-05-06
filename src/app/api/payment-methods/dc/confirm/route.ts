import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

const Body = z.object({
  paymentMethodId: z.string().min(1).max(200),
});

interface DcCard {
  id?: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

// POST /api/payment-methods/dc/confirm
//
// Called from the browser after stripe.confirmCardSetup() returns a
// pm_... id. We use DC's `list-payment-methods` to fetch the brand /
// last4 / exp metadata (DC verifies the card belongs to this
// platformUserId, so an attacker can't pass someone else's pm) and
// persist the row into UserPaymentMethod.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const list = await callDivinityCoinAPI("list-payment-methods", {
    platformUserId: session.user.id,
  });
  if (!list.ok) {
    return NextResponse.json(
      { error: "dc_list_failed", detail: list.error },
      { status: 502 },
    );
  }
  const pms = Array.isArray(list.data.paymentMethods)
    ? (list.data.paymentMethods as DcCard[])
    : [];
  const card = pms.find((p) => p.id === parsed.data.paymentMethodId);
  if (!card) {
    return NextResponse.json(
      { error: "payment_method_not_found", message: "DC did not return that card for your account." },
      { status: 404 },
    );
  }

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
        cardBrand: card.brand ?? null,
        cardLast4: card.last4 ?? null,
        cardExpMonth: card.expMonth ?? null,
        cardExpYear: card.expYear ?? null,
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
