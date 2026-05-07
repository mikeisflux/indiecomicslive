import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/seller/lots/[id]/auto-bids — the AutoBid stack on a lot,
// visible to the lot's seller (and admins). Useful for catching
// snipers / weird bid patterns before the lot goes live. We DO NOT
// expose the underlying bidder emails — only display name + handle —
// because the seller sees the high bid eventually anyway via Bid
// rows, and the auto-bid cap is more sensitive than the realized bid.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    select: { sellerId: true, showId: true, show: { select: { sellerId: true } } },
  });
  if (!lot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const isOwner =
    lot.sellerId === session.user.id ||
    lot.show?.sellerId === session.user.id;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.autoBid.findMany({
    where: { lotId: id, active: true },
    orderBy: [{ maxAmountCents: "desc" }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true, handle: true } },
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      maxAmountCents: r.maxAmountCents,
      createdAt: r.createdAt,
      label: r.user.name ?? (r.user.handle ? `@${r.user.handle}` : "buyer"),
    })),
  });
}
