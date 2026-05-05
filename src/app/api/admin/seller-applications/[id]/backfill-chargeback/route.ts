import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

// One-shot backfill for sellers whose chargeback card got written to
// the buyer table (UserPaymentMethod) instead of SellerChargebackCard
// because of an earlier bug. Finds the seller's most-recent
// non-deleted UserPaymentMethod and copies the vault id + card metadata
// into SellerChargebackCard. Idempotent — refuses to overwrite an
// existing chargeback card.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.sellerChargebackCard.findUnique({
    where: { userId: app.userId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "chargeback_card_already_exists" },
      { status: 409 },
    );
  }

  const upm = await prisma.userPaymentMethod.findFirst({
    where: { userId: app.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!upm || !upm.vaultId) {
    return NextResponse.json(
      { error: "no_buyer_card_to_backfill" },
      { status: 404 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.sellerChargebackCard.create({
      data: {
        userId: app.userId,
        nmiCustomerVaultId: upm.vaultId,
        cardBrand: upm.cardBrand,
        cardLastFour: upm.cardLast4 ?? "0000",
        expMonth: upm.cardExpMonth ?? 0,
        expYear: upm.cardExpYear ?? 0,
      },
    });
    // Soft-delete the misrouted buyer card so it doesn't double-charge
    // on a future buyer purchase. The PaymentCloud vault entry stays
    // intact (now owned by SellerChargebackCard).
    await tx.userPaymentMethod.update({
      where: { id: upm.id },
      data: { deletedAt: new Date() },
    });
  });

  await logAudit({
    actorId: me.id,
    action: "seller_application.backfill_chargeback",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: {
      sellerUserId: app.userId,
      sourcePaymentMethodId: upm.id,
      vaultId: upm.vaultId,
    },
  });

  return NextResponse.json({ ok: true });
}
