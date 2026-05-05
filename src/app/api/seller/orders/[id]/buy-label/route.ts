import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/admin";
import {
  createLabel,
  parseShippingAddress,
  shipFromJsonToAddress,
  voidLabel,
  type CreateLabelRequest,
} from "@/lib/shipstation";
import { r2Key, r2PutObject } from "@/lib/r2";

export const runtime = "nodejs";

interface Body {
  carrierCode?: string;
  serviceCode?: string;
  packageCode?: string;
  weight?: { value: number; units: "ounces" | "pounds" | "grams" | "kilograms" };
  dimensions?: { length: number; width: number; height: number; units: "inches" | "centimeters" };
  confirmation?: "none" | "delivery" | "signature" | "adult_signature";
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.carrierCode || !body.serviceCode || !body.packageCode || !body.weight) {
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
  if (!["paid"].includes(order.status)) {
    return NextResponse.json(
      { error: "wrong_status", message: `Order is ${order.status}; can't buy label` },
      { status: 409 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shipFromAddress: true },
  });
  const shipFrom = shipFromJsonToAddress(
    (me?.shipFromAddress ?? null) as Record<string, unknown> | null,
  );
  if (!shipFrom) {
    return NextResponse.json(
      { error: "no_ship_from", message: "Set a return address first." },
      { status: 400 },
    );
  }

  const shipTo = parseShippingAddress(order.shippingAddress);
  if (!shipTo) {
    return NextResponse.json(
      { error: "no_ship_to", message: "No structured shipping address on the order." },
      { status: 400 },
    );
  }

  const labelReq: CreateLabelRequest = {
    carrierCode: body.carrierCode,
    serviceCode: body.serviceCode,
    packageCode: body.packageCode,
    confirmation: body.confirmation,
    shipDate: todayYmd(),
    weight: body.weight,
    dimensions: body.dimensions,
    shipFrom,
    shipTo,
  };

  const result = await createLabel(labelReq);
  if (!result.ok) {
    return NextResponse.json(
      { error: "shipstation_error", message: result.error, status: result.status },
      { status: 502 },
    );
  }
  const label = result.data;

  // Persist the PDF to R2 so we can re-print without re-buying.
  const pdfBuf = Buffer.from(label.labelData, "base64");
  const key = r2Key(["labels", order.id, `${Date.now()}-${label.shipmentId}.pdf`]);
  try {
    await r2PutObject({ key, body: pdfBuf, contentType: "application/pdf" });
  } catch (e) {
    // R2 failed AFTER we already paid for the label. Try to claw it
    // back so we don't double-charge on retry.
    console.error("[buy-label] R2 upload failed; voiding ShipStation label", e);
    await voidLabel(label.shipmentId).catch(() => null);
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't archive label PDF; label voided." },
      { status: 502 },
    );
  }

  // Update the order. Status moves to 'shipped'; deliveredAt + payout
  // get set later by the ShipStation webhook + Thursday cron.
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "shipped",
      shipstationShipmentId: String(label.shipmentId),
      shippingCarrier: body.carrierCode,
      shippingService: body.serviceCode,
      shippingCostCents: Math.round((label.shipmentCost ?? 0) * 100),
      labelR2Key: key,
      trackingNumber: label.trackingNumber,
      shippedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "order.label_purchased",
    targetKind: "order",
    targetId: order.id,
    metadata: {
      shipstationShipmentId: label.shipmentId,
      tracking: label.trackingNumber,
      carrierCode: body.carrierCode,
      serviceCode: body.serviceCode,
      shipmentCost: label.shipmentCost,
    },
  });

  return NextResponse.json({
    ok: true,
    trackingNumber: updated.trackingNumber,
    labelUrl: `/api/seller/orders/${order.id}/label.pdf`,
  });
}
