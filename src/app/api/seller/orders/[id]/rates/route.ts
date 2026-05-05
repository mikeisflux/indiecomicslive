import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getRates,
  parseShippingAddress,
  shipFromJsonToAddress,
  type RateRequest,
} from "@/lib/shipstation";

export const runtime = "nodejs";

interface Body {
  carrierCode?: string;
  packageCode?: string;
  weight?: { value: number; units: "ounces" | "pounds" | "grams" | "kilograms" };
  dimensions?: { length: number; width: number; height: number; units: "inches" | "centimeters" };
  confirmation?: "none" | "delivery" | "signature" | "adult_signature";
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
  if (!body?.carrierCode || !body.weight) {
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

  const rateReq: RateRequest = {
    carrierCode: body.carrierCode,
    packageCode: body.packageCode,
    confirmation: body.confirmation,
    fromPostalCode: shipFrom.postalCode,
    toState: shipTo.state,
    toCountry: shipTo.country,
    toPostalCode: shipTo.postalCode,
    toCity: shipTo.city,
    weight: body.weight,
    dimensions: body.dimensions,
    residential: shipTo.residential,
  };

  const result = await getRates(rateReq);
  if (!result.ok) {
    return NextResponse.json(
      { error: "shipstation_error", message: result.error, status: result.status },
      { status: 502 },
    );
  }
  return NextResponse.json({ rates: result.data });
}
