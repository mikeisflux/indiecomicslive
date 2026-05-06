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

// POST /api/seller/chargeback-card/dc/confirm
//
// Called by the browser after stripe.confirmSetup succeeded. We use
// DC's `list-payment-methods` to fetch metadata (DC verifies the pm
// belongs to this platformUserId), then upsert SellerChargebackCard.
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

  await prisma.sellerChargebackCard.upsert({
    where: { userId: session.user.id },
    update: {
      processor: "divinitycoin",
      nmiCustomerVaultId: parsed.data.paymentMethodId,
      cardBrand: card.brand ?? null,
      cardLastFour: card.last4 ?? "0000",
      expMonth: card.expMonth ?? 0,
      expYear: card.expYear ?? 0,
    },
    create: {
      userId: session.user.id,
      processor: "divinitycoin",
      nmiCustomerVaultId: parsed.data.paymentMethodId,
      cardBrand: card.brand ?? null,
      cardLastFour: card.last4 ?? "0000",
      expMonth: card.expMonth ?? 0,
      expYear: card.expYear ?? 0,
    },
  });

  return NextResponse.json({ ok: true });
}
