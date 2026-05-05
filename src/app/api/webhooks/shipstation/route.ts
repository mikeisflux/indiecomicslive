import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ShipStation v1 webhooks for SHIP_NOTIFY and ITEM_SHIP_NOTIFY events.
// We verify the inbound request via a shared secret on the URL:
//   https://indiecomicslive.com/api/webhooks/shipstation?token=<SHIPSTATION_WEBHOOK_SECRET>
//
// SS POSTs a small JSON body that points at a "resource_url" we have to
// fetch back to get the actual shipment info. We don't need that level
// of detail to flip our orders — we maintain delivery state via the
// ITEM_SHIP_NOTIFY trigger.
//
// For the delivery-confirmed flag we either:
//   (a) Subscribe to a ShipStation "delivered" event if our plan
//       supports it, OR
//   (b) Accept periodic tracking polls — out of scope here.
// For the MVP we treat any inbound notification as "shipment exists";
// the actual delivered-state transition happens through the cron job
// that polls ShipStation `/shipments/{id}` for status === "delivered".
//
// Payload from ShipStation (v1 webhooks):
//   { resource_url: "https://ssapi.shipstation.com/...?...", resource_type: "..." }

interface ShipStationWebhookBody {
  resource_url?: string;
  resource_type?: string;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = process.env.SHIPSTATION_WEBHOOK_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ShipStationWebhookBody | null;
  console.log("[shipstation-webhook] hit", body);

  // We don't trigger any state change here yet — the Thursday cron is
  // the single source of truth for marking deliveries and triggering
  // payouts. This endpoint exists so SS has a working URL and we get
  // observability when shipments move.
  return NextResponse.json({ ok: true });
}
