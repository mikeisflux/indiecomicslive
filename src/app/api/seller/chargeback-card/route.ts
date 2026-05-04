import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addCustomerToVault,
  deleteVaultCustomer,
  loadNmiConfig,
  validateVaultCard,
} from "@/lib/nmi";

const Body = z.object({
  paymentToken: z.string().min(1).max(200),
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
  const card = await prisma.sellerChargebackCard.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      cardBrand: true,
      cardLastFour: true,
      expMonth: true,
      expYear: true,
    },
  });
  return NextResponse.json({ chargebackCard: card });
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
    select: { email: true },
  });

  const vaultResp = await addCustomerToVault(config, {
    paymentToken: parsed.data.paymentToken,
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

  if (vaultResp.response !== "1" || !vaultResp.customer_vault_id) {
    return NextResponse.json(
      { error: vaultResp.responsetext || "card_declined" },
      { status: 400 },
    );
  }

  const vaultId = vaultResp.customer_vault_id;
  const validation = await validateVaultCard(config, vaultId);
  if (validation.response !== "1") {
    await deleteVaultCustomer(config, vaultId).catch(() => null);
    return NextResponse.json(
      { error: validation.responsetext || "card_validation_failed" },
      { status: 400 },
    );
  }

  const cardBrand = validation.raw.cc_type ?? null;
  const cardLastFour = validation.raw.cc_number?.slice(-4) ?? "0000";
  const expRaw = validation.raw.cc_exp ?? "0000";
  const expMonth = Number(expRaw.slice(0, 2)) || 0;
  const expYear = 2000 + (Number(expRaw.slice(2, 4)) || 0);

  // Replace any existing card.
  const existing = await prisma.sellerChargebackCard.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) {
    await deleteVaultCustomer(config, existing.nmiCustomerVaultId).catch(
      () => null,
    );
    await prisma.sellerChargebackCard.delete({
      where: { userId: session.user.id },
    });
  }

  const card = await prisma.sellerChargebackCard.create({
    data: {
      userId: session.user.id,
      nmiCustomerVaultId: vaultId,
      cardBrand,
      cardLastFour,
      expMonth,
      expYear,
    },
    select: {
      id: true,
      cardBrand: true,
      cardLastFour: true,
      expMonth: true,
      expYear: true,
    },
  });

  return NextResponse.json({ chargebackCard: card });
}
