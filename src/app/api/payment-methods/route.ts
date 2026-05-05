import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addCustomerToVault, loadNmiConfig } from "@/lib/nmi";

const Body = z.object({
  paymentToken: z.string().min(1).max(200),
  // Card metadata returned by CollectJS in its tokenize callback.
  // We trust these for display only — the canonical source of truth
  // for actual charging is the customer_vault entry on NMI's side.
  cardBrand: z.string().max(50).nullable().optional(),
  cardNumberMasked: z.string().max(40).nullable().optional(),
  cardExp: z.string().max(8).nullable().optional(),
  billingFirstName: z.string().trim().max(100).optional(),
  billingLastName: z.string().trim().max(100).optional(),
  billingLine1: z.string().trim().max(200).optional(),
  billingLine2: z.string().trim().max(200).optional(),
  billingCity: z.string().trim().max(100).optional(),
  billingState: z.string().trim().max(100).optional(),
  billingZip: z.string().trim().max(20).optional(),
  billingCountry: z.string().trim().max(3).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const methods = await prisma.userPaymentMethod.findMany({
    where: { userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      cardBrand: true,
      cardLast4: true,
      cardExpMonth: true,
      cardExpYear: true,
      isDefault: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ methods });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const config = loadNmiConfig();
  if (!config) {
    return NextResponse.json({ error: "nmi_not_configured" }, { status: 502 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  // Pre-generate the vault id so we don't depend on PaymentCloud
  // echoing it back. NMI accepts arbitrary strings as customer_vault_id.
  const vaultId = `icl_${randomUUID().replace(/-/g, "")}`;

  console.log("[payment-methods] add_customer ->", {
    vaultId,
    email: user?.email,
    billing: {
      firstName: parsed.data.billingFirstName,
      lastName: parsed.data.billingLastName,
      line1: parsed.data.billingLine1,
      city: parsed.data.billingCity,
      state: parsed.data.billingState,
      zip: parsed.data.billingZip,
      country: parsed.data.billingCountry,
    },
  });

  const vaultResp = await addCustomerToVault(config, {
    paymentToken: parsed.data.paymentToken,
    customerVaultId: vaultId,
    firstName: parsed.data.billingFirstName,
    lastName: parsed.data.billingLastName,
    email: user?.email,
    address1: parsed.data.billingLine1,
    address2: parsed.data.billingLine2,
    city: parsed.data.billingCity,
    state: parsed.data.billingState,
    zip: parsed.data.billingZip,
    country: parsed.data.billingCountry,
  });

  console.log("[payment-methods] add_customer <-", {
    response: vaultResp.response,
    responsetext: vaultResp.responsetext,
    customer_vault_id: vaultResp.customer_vault_id,
    raw: vaultResp.raw,
  });

  if (vaultResp.response !== "1") {
    return NextResponse.json(
      { error: vaultResp.responsetext || "card_declined" },
      { status: 400 },
    );
  }

  // We deliberately skip a separate validate-vault auth-and-void step.
  // PCI rules forbid the gateway from storing CVV in the customer_vault,
  // and a vault-only auth without CVV gets rejected as "A card security
  // code has never been passed for this account". The add_customer call
  // already validates the payment_token (which carries CVV) at the
  // gateway, so a successful response is sufficient proof the card is
  // chargeable. Real declines surface on the actual sale_by_vault later.

  // Card display metadata comes from CollectJS's tokenize callback —
  // we forward it from the browser instead of trying to read it back
  // from the gateway.
  const cardBrand = parsed.data.cardBrand?.toLowerCase() ?? null;
  const masked = parsed.data.cardNumberMasked ?? "";
  const cardLast4 = masked ? masked.replace(/\D/g, "").slice(-4) : null;
  const expRaw = parsed.data.cardExp ?? "";
  const cardExpMonth = expRaw.length >= 2 ? Number(expRaw.slice(0, 2)) : null;
  const cardExpYear = expRaw.length >= 4 ? 2000 + Number(expRaw.slice(2, 4)) : null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.userPaymentMethod.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
    return await tx.userPaymentMethod.create({
      data: {
        userId: session.user.id,
        processor: "nmi",
        vaultId,
        cardBrand,
        cardLast4,
        cardExpMonth,
        cardExpYear,
        isDefault: true,
      },
    });
  });

  return NextResponse.json({
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
