import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

export type TipChargeResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: string };

// Charge an arbitrary live-show tip via DC's saved-card MIT path.
// pledgeId = tip.id (idempotency key — retrying with the same id
// returns the same charge instead of double-billing). projectId =
// showId. Updates the tip row to paid + records the DC transaction id
// on success, or marks failed with a reason on decline.
export async function chargeTip(tipId: string): Promise<TipChargeResult> {
  const tip = await prisma.showTip.findUnique({
    where: { id: tipId },
    select: {
      id: true,
      fromUserId: true,
      showId: true,
      amountCents: true,
      status: true,
    },
  });
  if (!tip) return { ok: false, reason: "tip_not_found" };
  if (tip.status === "paid") {
    return { ok: false, reason: "already_paid" };
  }

  const method = await prisma.userPaymentMethod.findFirst({
    where: {
      userId: tip.fromUserId,
      isDefault: true,
      deletedAt: null,
      processor: "divinitycoin",
    },
  });
  if (!method) {
    await prisma.showTip.update({
      where: { id: tip.id },
      data: { status: "failed", failureReason: "no_payment_method" },
    });
    return { ok: false, reason: "no_payment_method" };
  }

  const r = await callDivinityCoinAPI("charge-saved-payment-method", {
    platformUserId: tip.fromUserId,
    paymentMethodId: method.vaultId,
    amount: tip.amountCents,
    currency: "usd",
    pledgeId: tip.id,
    projectId: tip.showId,
    description: `Tip during live show ${tip.showId}`,
  });

  if (!r.ok) {
    await prisma.showTip.update({
      where: { id: tip.id },
      data: { status: "failed", failureReason: r.error.slice(0, 200) },
    });
    return { ok: false, reason: r.error };
  }

  const status = r.data.status as string | undefined;
  const txn =
    (r.data.paymentIntentId as string | undefined) ??
    (r.data.stripePaymentIntentId as string | undefined) ??
    (r.data.id as string | undefined);

  if (status !== "succeeded" || !txn) {
    const reason =
      (r.data.error as string | undefined) ?? `dc_status_${status ?? "unknown"}`;
    await prisma.showTip.update({
      where: { id: tip.id },
      data: { status: "failed", failureReason: reason.slice(0, 200) },
    });
    return { ok: false, reason };
  }

  await prisma.showTip.update({
    where: { id: tip.id },
    data: {
      status: "paid",
      dcTransactionId: txn,
      failureReason: null,
    },
  });
  return { ok: true, transactionId: txn };
}
