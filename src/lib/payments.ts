import { db, orders, userPaymentMethods, users } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  loadNmiConfig,
  saleByVaultToken,
  type NmiResponse,
} from "@/lib/nmi";

export type ChargeResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: string };

export async function chargeOrder(orderId: string): Promise<ChargeResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "pending_payment") {
    return { ok: false, reason: `order_status_${order.status}` };
  }

  const [method] = await db
    .select()
    .from(userPaymentMethods)
    .where(
      and(
        eq(userPaymentMethods.userId, order.buyerId),
        eq(userPaymentMethods.isDefault, true),
        isNull(userPaymentMethods.deletedAt),
      ),
    )
    .limit(1);

  if (!method) return { ok: false, reason: "no_payment_method" };

  const config = loadNmiConfig();
  if (!config) return { ok: false, reason: "nmi_not_configured" };

  const [buyer] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, order.buyerId));

  let resp: NmiResponse;
  try {
    resp = await saleByVaultToken(config, {
      amount: order.amountCents / 100,
      customerVaultId: method.vaultId,
      orderid: order.id,
      orderdescription: `Auction lot ${order.lotId}`,
      email: buyer?.email,
      // MIT: we are charging without the cardholder present; the
      // bidder authorized it when they placed the winning bid.
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

  await db
    .update(orders)
    .set({
      status: "paid",
      paymentProcessor: "nmi",
      nmiCustomerVaultId: method.vaultId,
      nmiTransactionId: resp.transactionid,
      paidAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // First successful sale on this vault entry — record it as the
  // initialTransactionId so future MIT charges can pass
  // stored_credential_indicator="used" + initial_transaction_id.
  if (!method.initialTransactionId) {
    await db
      .update(userPaymentMethods)
      .set({ initialTransactionId: resp.transactionid })
      .where(eq(userPaymentMethods.id, method.id));
  }

  return { ok: true, transactionId: resp.transactionid };
}
