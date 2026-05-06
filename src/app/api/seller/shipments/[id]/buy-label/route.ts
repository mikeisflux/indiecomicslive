import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/admin";
import { createTransaction, refundTransaction } from "@/lib/shippo";
import { r2Key, r2PutObject } from "@/lib/r2";

export const runtime = "nodejs";

const Body = z.object({
  rateId: z.string().min(1).max(200),
  provider: z.string().max(60).optional(),
  serviceName: z.string().max(120).optional(),
  amountCents: z.number().int().nonnegative().optional(),
});

// POST /api/seller/shipments/[id]/buy-label
//
// Buy a single Shippo label that covers every Order in this Shipment.
// The seller already quoted rates against the bundle (using the
// combined weight / largest dimensions of the items) and chose one;
// this endpoint just finalizes the purchase. Tracking + label are
// stored on the Shipment row and denormalized onto every linked
// Order so per-order pages keep working.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: shipmentId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { orders: true },
  });
  if (!shipment || shipment.sellerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (shipment.trackingNumber) {
    return NextResponse.json(
      { error: "already_shipped", message: "Label already purchased for this shipment." },
      { status: 409 },
    );
  }
  if (shipment.orders.length === 0) {
    return NextResponse.json(
      { error: "empty_shipment", message: "No orders in this shipment." },
      { status: 400 },
    );
  }
  for (const o of shipment.orders) {
    if (o.status !== "paid") {
      return NextResponse.json(
        { error: "wrong_status", message: `Order ${o.id.slice(0, 8)}… is ${o.status}; can't buy label` },
        { status: 409 },
      );
    }
  }

  const result = await createTransaction(parsed.data.rateId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "shippo_error", message: result.error, status: result.status },
      { status: 502 },
    );
  }
  const tx = result.data;
  if (tx.status !== "SUCCESS" || !tx.tracking_number || !tx.label_url) {
    const detail =
      (tx.messages ?? []).map((m) => m.text).join("; ") ||
      `status=${tx.status}`;
    return NextResponse.json(
      { error: "transaction_failed", message: detail },
      { status: 502 },
    );
  }

  let pdfBuf: Buffer;
  try {
    const r = await fetch(tx.label_url);
    if (!r.ok) throw new Error(`label fetch ${r.status}`);
    pdfBuf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error("[buy-label/shipment] couldn't pull label PDF; refunding", e);
    await refundTransaction(tx.object_id).catch(() => null);
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't pull label PDF; transaction refunded." },
      { status: 502 },
    );
  }
  const key = r2Key(["labels", shipment.id, `${Date.now()}-${tx.object_id}.pdf`]);
  try {
    await r2PutObject({ key, body: pdfBuf, contentType: "application/pdf" });
  } catch (e) {
    console.error("[buy-label/shipment] R2 upload failed; refunding label", e);
    await refundTransaction(tx.object_id).catch(() => null);
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't archive label PDF; label refunded." },
      { status: 502 },
    );
  }

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipstationShipmentId: tx.object_id,
        shippingCarrier: parsed.data.provider ?? null,
        shippingService: parsed.data.serviceName ?? null,
        shippingCostCents: parsed.data.amountCents ?? null,
        labelR2Key: key,
        trackingNumber: tx.tracking_number,
        shippedAt: new Date(),
      },
    }),
    prisma.order.updateMany({
      where: { shipmentId: shipment.id },
      data: {
        status: "shipped",
        shipstationShipmentId: tx.object_id,
        shippingCarrier: parsed.data.provider ?? null,
        shippingService: parsed.data.serviceName ?? null,
        shippingCostCents: parsed.data.amountCents ?? null,
        labelR2Key: key,
        trackingNumber: tx.tracking_number,
        shippedAt: new Date(),
      },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "shipment.label_purchased",
    targetKind: "shipment",
    targetId: shipment.id,
    metadata: {
      orderCount: shipment.orders.length,
      shippoTransactionId: tx.object_id,
      tracking: tx.tracking_number,
      provider: parsed.data.provider,
      serviceName: parsed.data.serviceName,
      amountCents: parsed.data.amountCents,
    },
  });

  return NextResponse.json({
    ok: true,
    trackingNumber: tx.tracking_number,
    trackingUrl: tx.tracking_url_provider,
    labelUrl: `/api/seller/shipments/${shipment.id}/label.pdf`,
    orderCount: shipment.orders.length,
  });
}
