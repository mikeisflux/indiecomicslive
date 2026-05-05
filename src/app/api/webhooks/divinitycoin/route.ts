import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  getDivinityCoinConfig,
  handleTestPing,
} from "@/lib/divinitycoin";

// POST /api/webhooks/divinitycoin
//
// DivinityCoin posts events here. Verify HMAC-SHA256 signature in the
// X-Webhook-Signature header against the platform's webhook secret,
// then dispatch on event type. Currently we only acknowledge + log
// non-test events — actual handling (charge → ledger row, refund →
// order update, etc.) lands as we wire DC into the auction close flow.
export async function POST(req: Request) {
  const body = await req.text();
  const signature =
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-divinity-signature") ??
    "";

  if (!signature) {
    console.warn("[divinitycoin-webhook] missing signature header");
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event;
  try {
    event = await constructWebhookEvent(body, signature);
  } catch (e) {
    console.warn("[divinitycoin-webhook] verify failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  console.log("[divinitycoin-webhook] received", {
    event: event.event,
    paymentId: event.data?.paymentId,
    pledgeId: event.data?.pledgeId,
    amount: event.data?.amount,
  });

  switch (event.event) {
    case "test.ping":
      return NextResponse.json(await handleTestPing());

    case "card.validate":
      // Indie Comics Live doesn't sell DC gift cards yet — politely
      // tell DC the card isn't recognised here.
      return NextResponse.json({
        valid: false,
        status: "not_supported",
        amount: 0,
      });

    case "card.redeem":
      return NextResponse.json({
        success: false,
        amount: 0,
        error: "card_redemption_not_supported",
      });

    case "payment.succeeded":
      // TODO(auction): mark the corresponding Order as paid + write
      // a PaymentLedger row. Wire when we charge auction wins via DC.
      return NextResponse.json({ success: true });

    case "payment.failed":
      // TODO(auction): mark Order as failed + notify the buyer.
      return NextResponse.json({ success: true });

    case "refund.completed":
      return NextResponse.json({ success: true });

    case "refund.request":
      return NextResponse.json({
        success: false,
        refundId: event.data?.refundId ?? "unknown",
        amountDeducted: 0,
        previousBalance: 0,
        newBalance: 0,
        error: "refund_handler_not_yet_implemented",
      });

    default:
      console.warn("[divinitycoin-webhook] unknown event", { event: event.event });
      return NextResponse.json({ ok: true, ignored: true });
  }
}

// GET — health check. Returns whether DC is configured + which events
// we accept. Useful for the partner integration check.
export async function GET() {
  const cfg = await getDivinityCoinConfig();
  return NextResponse.json({
    status: cfg ? "active" : "not_configured",
    partnerId: cfg?.partnerId ?? null,
    supportedEvents: [
      "test.ping",
      "card.validate",
      "card.redeem",
      "payment.succeeded",
      "payment.failed",
      "refund.completed",
      "refund.request",
    ],
  });
}
