import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/shows/[id]/giveaways — host (the show's seller, or one of
// the show's moderators) starts a giveaway. Returns the new id.
const Create = z.object({
  prize: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  rules: z.string().max(500).optional(),
  closesInSeconds: z.number().int().min(15).max(60 * 60).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  });
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const isHost = show.sellerId === session.user.id;
  let allowed = isHost;
  if (!allowed) {
    const mod = await prisma.showModerator.findUnique({
      where: {
        showId_userId: { showId: id, userId: session.user.id },
      },
    });
    allowed = !!mod;
  }
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const closesAt = parsed.data.closesInSeconds
    ? new Date(Date.now() + parsed.data.closesInSeconds * 1000)
    : null;
  // At most one open giveaway per show — concurrent "Start" clicks
  // serialize and the second one returns 409 instead of inserting a
  // duplicate row.
  const g = await prisma.$transaction(
    async (tx) => {
      const conflict = await tx.giveaway.findFirst({
        where: { showId: id, status: "open" },
        select: { id: true },
      });
      if (conflict) return null;
      return tx.giveaway.create({
        data: {
          showId: id,
          hostId: session.user.id,
          prize: parsed.data.prize,
          description: parsed.data.description,
          rules: parsed.data.rules,
          closesAt,
          status: "open",
        },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
  if (!g) {
    return NextResponse.json(
      {
        error: "already_open",
        message: "There's already an open giveaway on this show.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: g.id });
}

// GET — list active + recent giveaways for the show.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const items = await prisma.giveaway.findMany({
    where: { showId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      _count: { select: { entries: true } },
      winner: { select: { handle: true, name: true } },
    },
  });
  return NextResponse.json({
    items: items.map((g) => ({
      id: g.id,
      prize: g.prize,
      description: g.description,
      rules: g.rules,
      status: g.status,
      entries: g._count.entries,
      winner: g.winner
        ? g.winner.name ?? `@${g.winner.handle ?? "winner"}`
        : null,
      closesAt: g.closesAt,
      createdAt: g.createdAt,
    })),
  });
}
