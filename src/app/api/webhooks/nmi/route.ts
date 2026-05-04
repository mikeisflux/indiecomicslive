import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { loadNmiConfig } from "@/lib/nmi";
import { isIPBlocked, recordSuspiciousActivity } from "@/lib/bot-blocker";
import { getClientIP, getUserAgent } from "@/lib/client-ip";

// PaymentCloud / NMI webhook. Configure under
// "Webhooks" in the merchant portal.
//
// NMI signs webhooks with HMAC-SHA256 over the raw body using the
// shared secret. Header name is configurable in the portal — common
// choices are X-Nmi-Signature or x-nmi-webhook-signature. We accept
// either (lowercased).
//
// Events we care about:
//   transaction.refund.success     → mark order refunded
//   transaction.chargeback.created → flag order for review
//   transaction.sale.failure       → if it matches a recent sale, ignore
//                                    (we'd already have updated state)

type NmiEvent = {
  event_type?: string;
  event_body?: {
    transaction_id?: string;
    order_id?: string;
    amount?: string;
  };
};

function verify(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(header.replace(/^sha256=/, ""), "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (await isIPBlocked(ip)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const config = loadNmiConfig();
  if (!config?.webhookSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 502 });
  }

  const raw = await req.text();
  const header =
    req.headers.get("x-nmi-signature") ??
    req.headers.get("x-nmi-webhook-signature") ??
    req.headers.get("x-signature");

  if (!verify(raw, header, config.webhookSecret)) {
    // Hitting our webhook without a valid signature is exploit-probe
    // territory. 3 of these inside an hour and the IP is autobanned.
    await recordSuspiciousActivity(ip, "nmi_webhook_bad_signature", {
      path: "/api/webhooks/nmi",
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as NmiEvent;
  const transactionId = event.event_body?.transaction_id;
  const orderId = event.event_body?.order_id;
  const type = event.event_type ?? "";

  if (!type) {
    return NextResponse.json({ ok: true, ignored: "no_event_type" });
  }

  // Match the order: prefer order_id (we set it as `orderid` on the sale)
  // and fall back to nmiTransactionId.
  const order = orderId
    ? await prisma.order.findUnique({ where: { id: orderId } })
    : transactionId
      ? await prisma.order.findFirst({
          where: { nmiTransactionId: transactionId },
        })
      : null;

  if (!order) {
    return NextResponse.json({ ok: true, ignored: "no_match" });
  }

  if (type.includes("refund")) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "refunded" },
    });
  } else if (type.includes("chargeback")) {
    // For MVP, just flag in the description-like field. Add a proper
    // chargebacks table later if you need per-event detail.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "cancelled" },
    });
  }

  return NextResponse.json({ ok: true });
}
