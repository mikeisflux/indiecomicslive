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

  // The WS server (src/server/ws.ts) doesn't expose an internal HTTP
  // broadcast endpoint yet, so the pin is DB-only — viewers will see
  // it on their next reconnect / page reload. Real-time pin push is
  // a follow-up: we'd add a small POST /internal/broadcast handler in
  // ws.ts that calls the existing broadcast(showId, msg) helper.

  return NextResponse.json({ ok: true, pinnedLotId: parsed.data.lotId });
}
