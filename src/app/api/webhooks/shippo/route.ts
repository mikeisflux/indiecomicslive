import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShippoWebhookSecret } from "@/lib/shippo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shippo tracking webhook. Configure in the Shippo dashboard:
//   POST URL:  https://indiecomicslive.com/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>
//   Event:     track_updated
//
// Shippo doesn't sign the body; we authenticate via a shared secret
// in the URL query.
//
// Body shape (track_updated):
//   {
//     "event": "track_updated",
//     "data": {
//       "tracking_number": "...",
//       "carrier": "usps",
//       "tracking_status": { "status": "DELIVERED", "status_date": "..." },
//       ...
//     }
//   }
//
// Status values we care about: DELIVERED → flip Order.deliveredAt
// (and the parent Shipment, if any). Other statuses (TRANSIT,
// RETURNED, FAILURE) are logged for observability but don't change
// state — admins can intervene if a return / failure happens.

interface ShippoWebhook {
  event?: string;
  data?: {
    tracking_number?: string;
    carrier?: string;
    tracking_status?: {
      status?: string;
      status_date?: string;
    };
  };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = await getShippoWebhookSecret();
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ShippoWebhook | null;
  console.log("[shippo-webhook]", {
    event: body?.event,
    tracking: body?.data?.tracking_number,
    status: body?.data?.tracking_status?.status,
  });

  const tracking = body?.data?.tracking_number;
  const status = body?.data?.tracking_status?.status?.toUpperCase();
  if (!tracking || !status) {
    return NextResponse.json({ ok: true, ignored: "no_tracking_or_status" });
  }

  // Order with this tracking number (covers both single-order shipments
  // and bundled orders since we denormalized tracking onto every order).
  if (status === "DELIVERED") {
    const deliveredAt = body?.data?.tracking_status?.status_date
      ? new Date(body.data.tracking_status.status_date)
      : new Date();

    const updated = await prisma.order.updateMany({
      where: { trackingNumber: tracking, deliveredAt: null },
      data: { status: "delivered", deliveredAt },
    });
    await prisma.shipment.updateMany({
      where: { trackingNumber: tracking, deliveredAt: null },
      data: { deliveredAt },
    });

    console.log("[shippo-webhook] marked delivered", {
      tracking,
      orders: updated.count,
    });
  }

  return NextResponse.json({ ok: true });
}
