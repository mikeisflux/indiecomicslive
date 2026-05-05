import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

const Body = z.object({
  setupIntentId: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1).max(200),
});

// POST /api/seller/chargeback-card/dc/confirm
//
// Called by the browser after stripe.confirmSetup succeeded. We ask DC
// for the metadata we need (brand, last4, exp) since we never see it
// directly from Stripe in the browser, then upsert into
// SellerChargebackCard with processor='divinitycoin'.
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
    card && typeof card.last4 === "string" ? (card.last4 as string) : "0000";
  const expMonth =
    card && typeof card.exp_month === "number"
      ? (card.exp_month as number)
      : 0;
  const expYear =
    card && typeof card.exp_year === "number" ? (card.exp_year as number) : 0;

  await prisma.sellerChargebackCard.upsert({
    where: { userId: session.user.id },
    update: {
      processor: "divinitycoin",
      nmiCustomerVaultId: parsed.data.paymentMethodId,
      cardBrand: brand,
      cardLastFour: last4,
      expMonth,
      expYear,
    },
    create: {
      userId: session.user.id,
      processor: "divinitycoin",
      nmiCustomerVaultId: parsed.data.paymentMethodId,
      cardBrand: brand,
      cardLastFour: last4,
      expMonth,
      expYear,
    },
  });

  return NextResponse.json({ ok: true });
}
