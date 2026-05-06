import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushToUser } from "@/lib/push";

export const runtime = "nodejs";

// POST /api/giveaways/[id]/enter is mounted as the parent + an
// /enter sub-route. This file handles the host operations:
//   PATCH { action: "draw" | "cancel" }
async function isHostOrMod(
  showId: string,
  hostId: string,
  userId: string,
): Promise<boolean> {
  if (hostId === userId) return true;
  const mod = await prisma.showModerator.findUnique({
    where: { showId_userId: { showId, userId } },
  });
  return !!mod;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: string;
  } | null;
  const action = body?.action;
  if (action !== "draw" && action !== "cancel") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const g = await prisma.giveaway.findUnique({
    where: { id },
    select: {
      id: true,
      showId: true,
      hostId: true,
      prize: true,
      status: true,
      show: { select: { sellerId: true, title: true } },
    },
  });
  if (!g) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const allowed = await isHostOrMod(g.showId, g.show.sellerId, session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "cancel") {
    await prisma.giveaway.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  }

  // Draw — pick a random entrant.
  if (g.status !== "open" && g.status !== "closed") {
    return NextResponse.json({ error: "already_drawn" }, { status: 409 });
  }
  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId: id },
    select: { userId: true },
  });
  if (entries.length === 0) {
    await prisma.giveaway.update({
      where: { id },
      data: { status: "drawn", drawnAt: new Date() },
    });
    return NextResponse.json({ ok: true, winnerId: null });
  }
  const winner = entries[Math.floor(Math.random() * entries.length)];
  await prisma.giveaway.update({
    where: { id },
    data: {
      status: "drawn",
      drawnAt: new Date(),
      winnerId: winner.userId,
    },
  });

  pushToUser(winner.userId, {
    kind: "giveaway_won",
    title: `🎉 You won — ${g.prize}`,
    body: `From ${g.show.title}. The seller will reach out to ship it.`,
    url: `/s/${g.showId}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, winnerId: winner.userId });
}
