import { prisma } from "@/lib/prisma";
import {
  loadNmiConfig,
  saleByVaultToken,
  type NmiResponse,
} from "@/lib/nmi";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

export type ChargeResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: string };

// Top-level charge: looks at the buyer's default saved payment method
// and dispatches to the right processor. NMI uses the long-lived
// customer vault id and a sale_by_vault call. Divinity Payments uses
// off-session Stripe payment intents created on DC's account; the
// payment_method_id we stored at vault time is the same one Stripe
// used to issue the SetupIntent — re-using it here is a normal
// merchant-initiated stored-credential transaction.
export async function chargeOrder(orderId: string): Promise<ChargeResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "pending_payment") {
    return { ok: false, reason: `order_status_${order.status}` };
  }

  const method = await prisma.userPaymentMethod.findFirst({
    where: { userId: order.buyerId, isDefault: true, deletedAt: null },
  });
  if (!method) return { ok: false, reason: "no_payment_method" };

  return method.processor === "divinitycoin"
    ? chargeOrderDc(orderId, method)
    : chargeOrderNmi(orderId, method);
}

async function chargeOrderNmi(
  orderId: string,
  method: { id: string; vaultId: string; initialTransactionId: string | null },
): Promise<ChargeResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "order_not_found" };

  const config = loadNmiConfig();
  if (!config) return { ok: false, reason: "nmi_not_configured" };

  const buyer = await prisma.user.findUnique({
    where: { id: order.buyerId },
    select: { email: true },
  });

  let resp: NmiResponse;
  try {
    resp = await saleByVaultToken(config, {
      amount: order.amountCents / 100,
      customerVaultId: method.vaultId,
      orderid: order.id,
      orderdescription: `Auction lot ${order.lotId}`,
      email: buyer?.email,
      initiatedBy: "merchant",
      storedCredentialIndicator: method.initialTransactionId ? "used" : "stored",
      initialTransactionId: method.initialTransactionId ?? undefined,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "nmi_network_error",
    };
  }

  if (resp.response !== "1" || !resp.transactionid) {
    return { ok: false, reason: resp.responsetext || "declined" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      paymentProcessor: "nmi",
      nmiCustomerVaultId: method.vaultId,
      nmiTransactionId: resp.transactionid,
      paidAt: new Date(),
    },
  });

  if (!method.initialTransactionId) {
    await prisma.userPaymentMethod.update({
      where: { id: method.id },
      data: { initialTransactionId: resp.transactionid },
    });
  }

  return { ok: true, transactionId: resp.transactionid };
}

async function chargeOrderDc(
  orderId: string,
  method: { id: string; vaultId: string; initialTransactionId: string | null },
): Promise<ChargeResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "order_not_found" };

  // DC's charge-saved-payment-method takes platformUserId + the
  // pm_... id we stored at vault time and runs an off_session
  // PaymentIntent on DC's Stripe account. The order id doubles as
  // the idempotency key (`pledgeId` in DC's vocabulary) so a retry
  // returns the same charge instead of double-billing.
  const r = await callDivinityCoinAPI("charge-saved-payment-method", {
    platformUserId: order.buyerId,
    paymentMethodId: method.vaultId,
    amount: order.amountCents,
    currency: "usd",
    pledgeId: order.id,
    projectId: order.lotId,
    description: `Auction lot ${order.lotId}`,
  });

  if (!r.ok) {
    return { ok: false, reason: r.error };
  }
  const status = r.data.status as string | undefined;
  const txn =
    (r.data.paymentIntentId as string | undefined) ??
    (r.data.stripePaymentIntentId as string | undefined) ??
    (r.data.id as string | undefined);

  if (status !== "succeeded" || !txn) {
    return {
      ok: false,
      reason:
        (r.data.error as string | undefined) ?? `dc_status_${status ?? "unknown"}`,
    };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      paymentProcessor: "divinitycoin",
      nmiCustomerVaultId: method.vaultId,
      nmiTransactionId: txn,
      paidAt: new Date(),
    },
  });

  if (!method.initialTransactionId) {
    await prisma.userPaymentMethod.update({
      where: { id: method.id },
      data: { initialTransactionId: txn },
    });
  }

  return { ok: true, transactionId: txn };
}
