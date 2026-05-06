import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  createShipment,
  parseShippingAddress,
  shipFromJsonToAddress,
  type ShippoParcel,
} from "@/lib/shippo";

export const runtime = "nodejs";

const Body = z.object({
  weight: z.object({
    value: z.number().positive(),
    units: z.enum(["lb", "oz", "g", "kg"]),
  }),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      units: z.enum(["in", "cm"]),
    })
    .optional(),
  signatureConfirmation: z.enum(["none", "standard", "adult"]).optional(),
});

// POST /api/seller/orders/[id]/rates
//
// Quote shipping rates from every connected carrier for one order via
// Shippo. Returns a flat array of rate options the seller picks from
// in the UI; we hand the chosen `rateId` to /buy-label.
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
  if (!["paid", "shipped"].includes(order.status)) {
    return NextResponse.json(
      { error: "wrong_status", message: `Order is ${order.status}; can't quote` },
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

  const parcel: ShippoParcel = {
    weight: String(parsed.data.weight.value),
    mass_unit: parsed.data.weight.units,
    length: String(parsed.data.dimensions?.length ?? 6),
    width: String(parsed.data.dimensions?.width ?? 6),
    height: String(parsed.data.dimensions?.height ?? 1),
    distance_unit: parsed.data.dimensions?.units ?? "in",
  };

  const sigMap = { standard: "STANDARD", adult: "ADULT" } as const;
  const sig =
    parsed.data.signatureConfirmation &&
    parsed.data.signatureConfirmation !== "none"
      ? sigMap[parsed.data.signatureConfirmation]
      : undefined;

  const result = await createShipment({
    address_from: shipFrom,
    address_to: shipTo,
    parcels: [parcel],
    extra: sig ? { signature_confirmation: sig } : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "shippo_error", message: result.error, status: result.status },
      { status: 502 },
    );
  }

  const rates = (result.data.rates ?? []).map((r) => ({
    rateId: r.object_id,
    provider: r.provider,
    serviceName: r.servicelevel.name,
    serviceToken: r.servicelevel.token,
    amountCents: Math.round(parseFloat(r.amount) * 100),
    currency: r.currency,
    estimatedDays: r.estimated_days ?? null,
  }));
  rates.sort((a, b) => a.amountCents - b.amountCents);

  return NextResponse.json({ rates, shipmentId: result.data.object_id });
}
