import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/admin";
import { createTransaction, refundTransaction } from "@/lib/shippo";
import { r2Key, r2PutObject } from "@/lib/r2";

export const runtime = "nodejs";

const Body = z.object({
  rateId: z.string().min(1).max(200),
  // Snapshot of carrier + service the rate represented — saved on the
  // Order so the order detail page can display them without another
  // Shippo round-trip.
  provider: z.string().max(60).optional(),
  serviceName: z.string().max(120).optional(),
  amountCents: z.number().int().nonnegative().optional(),
});

// POST /api/seller/orders/[id]/buy-label
//
// Buy a Shippo label for one order. The seller already picked a rate
// from /rates and we just need to turn it into a transaction. Stores
// the resulting label PDF in R2 and writes tracking back to the Order.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.sellerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.trackingNumber) {
    return NextResponse.json(
      { error: "already_shipped", message: "Label already purchased for this order." },
      { status: 409 },
    );
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "wrong_status", message: `Order is ${order.status}; can't buy label` },
      { status: 409 },
    );
  }

  // Race-safe claim: stamp a sentinel tracking value BEFORE we hit
  // Shippo so a concurrent double-click can't both buy a label
  // (Shippo charges per transaction). The real tracking number
  // overwrites the sentinel on success; on failure we clear the
  // sentinel below.
  const sentinel = `__pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const claimed = await prisma.order.updateMany({
    where: {
      id: order.id,
      sellerId: session.user.id,
      trackingNumber: null,
      status: "paid",
    },
    data: { trackingNumber: sentinel },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      {
        error: "race_lost",
        message: "Another tab already started buying a label for this order.",
      },
      { status: 409 },
    );
  }

  // Helper to release the sentinel on any downstream failure so the
  // seller can retry without waiting for a manual unstick.
  const releaseSentinel = () =>
    prisma.order
      .updateMany({
        where: { id: order.id, trackingNumber: sentinel },
        data: { trackingNumber: null },
      })
      .catch(() => null);

  const result = await createTransaction(parsed.data.rateId);
  if (!result.ok) {
    await releaseSentinel();
    return NextResponse.json(
      { error: "shippo_error", message: result.error, status: result.status },
      { status: 502 },
    );
  }
  const tx = result.data;
  if (tx.status !== "SUCCESS" || !tx.tracking_number || !tx.label_url) {
    await releaseSentinel();
    const detail =
      (tx.messages ?? []).map((m) => m.text).join("; ") ||
      `status=${tx.status}`;
    return NextResponse.json(
      { error: "transaction_failed", message: detail },
      { status: 502 },
    );
  }

  // Pull the label PDF from Shippo and stash in R2 so reprints are free.
  let pdfBuf: Buffer;
  try {
    const r = await fetch(tx.label_url);
    if (!r.ok) throw new Error(`label fetch ${r.status}`);
    pdfBuf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error("[buy-label] couldn't pull label PDF; refunding", e);
    await refundTransaction(tx.object_id).catch(() => null);
    await releaseSentinel();
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't pull label PDF; transaction refunded." },
      { status: 502 },
    );
  }
  const key = r2Key(["labels", order.id, `${Date.now()}-${tx.object_id}.pdf`]);
  try {
    await r2PutObject({ key, body: pdfBuf, contentType: "application/pdf" });
  } catch (e) {
    console.error("[buy-label] R2 upload failed; refunding label", e);
    await refundTransaction(tx.object_id).catch(() => null);
    await releaseSentinel();
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't archive label PDF; label refunded." },
      { status: 502 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "shipped",
      // Field name kept for back-compat; semantically it now stores
      // Shippo's transaction object_id.
      shipstationShipmentId: tx.object_id,
      shippingCarrier: parsed.data.provider ?? null,
      shippingService: parsed.data.serviceName ?? null,
      shippingCostCents: parsed.data.amountCents ?? null,
      labelR2Key: key,
      trackingNumber: tx.tracking_number,
      shippedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "order.label_purchased",
    targetKind: "order",
    targetId: order.id,
    metadata: {
      shippoTransactionId: tx.object_id,
      tracking: tx.tracking_number,
      provider: parsed.data.provider,
      serviceName: parsed.data.serviceName,
      amountCents: parsed.data.amountCents,
    },
  });

  return NextResponse.json({
    ok: true,
    trackingNumber: updated.trackingNumber,
    trackingUrl: tx.tracking_url_provider,
    labelUrl: `/api/seller/orders/${order.id}/label.pdf`,
  });
}
