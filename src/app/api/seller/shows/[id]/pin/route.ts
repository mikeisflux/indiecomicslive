import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PUT /api/seller/shows/[id]/pin
// Sets (or clears, when lotId is null) the show's "now selling" pin.
// Only the show's seller (or a platform admin) can change it.
// Broadcasts a state change so live viewers update without refresh.
const Body = z.object({
  lotId: z.string().uuid().nullable(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: showId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const isSeller = show.sellerId === session.user.id;
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  if (!isSeller && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (parsed.data.lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: parsed.data.lotId } });
    if (!lot || lot.showId !== showId) {
      return NextResponse.json(
        { error: "lot_not_in_show" },
        { status: 400 },
      );
    }
  }

  await prisma.show.update({
    where: { id: showId },
    data: { pinnedLotId: parsed.data.lotId },
  });

  // Best-effort: push a 'pin' message to live viewers via the WS
  // server's internal HTTP endpoint. Failure is non-fatal — the
  // pin write to Postgres is the durable source of truth, viewers
  // will pick it up on next reconnect / refresh either way.
  const wsPort = process.env.WS_PORT ?? "3001";
  const wsSecret = process.env.WS_INTERNAL_SECRET;
  if (wsSecret) {
    fetch(`http://127.0.0.1:${wsPort}/internal/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-broadcast-token": wsSecret,
      },
      body: JSON.stringify({
        showId,
        msg: { type: "pin", lotId: parsed.data.lotId },
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, pinnedLotId: parsed.data.lotId });
}
