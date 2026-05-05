// DivinityCoin processor: payments are powered by DC's Stripe Connect
// flow under the hood — what looks like a normal credit-card form to
// our buyers is in fact Stripe Elements pointed at a payment-intent
// created on DC's account. We talk to DC for create / capture /
// refund and DC posts events back to our /api/webhooks/divinitycoin.
//
// All ported from indiecrowdfund_2.0/src/lib/payments/divinitycoin.

export type DivinityCoinEventType =
  | "test.ping"
  | "card.validate"
  | "card.redeem"
  | "refund.request"
  | "payment.succeeded"
  | "payment.failed"
  | "refund.completed";

export interface DivinityCoinConfig {
  apiKey: string;
  partnerId: string;
  webhookSecret: string;
  baseUrl: string;
}

export interface DivinityCoinWebhookRequest {
  event: DivinityCoinEventType;
  data?: {
    cardCode?: string;
    platformUserId?: string;
    refundId?: string;
    amount?: number;
    reason?: string;
    originalTransactionId?: string;
    originalCardCode?: string;
    paymentId?: string;
    pledgeId?: string;
    projectId?: string;
    holdId?: string;
    stripePaymentIntentId?: string;
    giftCardCode?: string;
    email?: string;
    [key: string]: unknown;
  };
}

export interface TestPingResponse {
  success: true;
  message: string;
  partnerId: string;
  sandboxMode: boolean;
}
