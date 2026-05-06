import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

// POST /api/seller/shipments/[id]/buy-label
//
// Buy a single ShipStation label that covers every Order in this
// Shipment. The orders share a buyer (enforced when the bundle was
// created), so they share a ship-to address — we use the address
// from the first order. The label PDF is cached in R2 once and the
// resulting tracking number is denormalized onto every Order in the
// shipment so per-order pages stay accurate.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: shipmentId } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.carrierCode || !body.serviceCode || !body.packageCode || !body.weight) {
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

  const shipTo = parseShippingAddress(shipment.orders[0].shippingAddress);
  if (!shipTo) {
    return NextResponse.json(
      { error: "no_ship_to", message: "No structured shipping address on the buyer's first order." },
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

  const pdfBuf = Buffer.from(label.labelData, "base64");
  const key = r2Key(["labels", shipment.id, `${Date.now()}-${label.shipmentId}.pdf`]);
  try {
    await r2PutObject({ key, body: pdfBuf, contentType: "application/pdf" });
  } catch (e) {
    console.error("[buy-label/shipment] R2 upload failed; voiding label", e);
    await voidLabel(label.shipmentId).catch(() => null);
    return NextResponse.json(
      { error: "label_archive_failed", message: "Couldn't archive label PDF; label voided." },
      { status: 502 },
    );
  }

  // Persist tracking + label to the Shipment AND denormalize onto
  // every linked Order so existing per-order UI keeps working.
  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipstationShipmentId: String(label.shipmentId),
        shippingCarrier: body.carrierCode,
        shippingService: body.serviceCode,
        shippingCostCents: Math.round((label.shipmentCost ?? 0) * 100),
        labelR2Key: key,
        trackingNumber: label.trackingNumber,
        shippedAt: new Date(),
      },
    }),
    prisma.order.updateMany({
      where: { shipmentId: shipment.id },
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
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "shipment.label_purchased",
    targetKind: "shipment",
    targetId: shipment.id,
    metadata: {
      orderCount: shipment.orders.length,
      shipstationShipmentId: label.shipmentId,
      tracking: label.trackingNumber,
      carrierCode: body.carrierCode,
      serviceCode: body.serviceCode,
      shipmentCost: label.shipmentCost,
    },
  });

  return NextResponse.json({
    ok: true,
    trackingNumber: label.trackingNumber,
    labelUrl: `/api/seller/shipments/${shipment.id}/label.pdf`,
    orderCount: shipment.orders.length,
  });
}
