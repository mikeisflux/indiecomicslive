import { prisma } from "@/lib/prisma";
import {
  loadNmiConfig,
  saleByVaultToken,
  type NmiResponse,
} from "@/lib/nmi";

export type ChargeResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: string };

export async function chargeOrder(orderId: string): Promise<ChargeResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "pending_payment") {
    return { ok: false, reason: `order_status_${order.status}` };
  }

  const method = await prisma.userPaymentMethod.findFirst({
    where: {
      userId: order.buyerId,
      isDefault: true,
      deletedAt: null,
    },
  });
  if (!method) return { ok: false, reason: "no_payment_method" };

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
      // MIT: cardholder authorized this charge when they placed the
      // winning bid. Tag accordingly so the gateway and card networks
      // recognize this as expected stored-credential use.
      initiatedBy: "merchant",
      storedCredentialIndicator: method.initialTransactionId
        ? "used"
        : "stored",
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

  // First successful sale on this vault entry — record the txn id so
  // future MIT charges can pass stored_credential_indicator="used"
  // + initial_transaction_id for clean interchange.
  if (!method.initialTransactionId) {
    await prisma.userPaymentMethod.update({
      where: { id: method.id },
      data: { initialTransactionId: resp.transactionid },
    });
  }

  return { ok: true, transactionId: resp.transactionid };
}
