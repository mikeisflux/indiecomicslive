import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST { handle: string } — host adds the named user as a moderator.
// DELETE { userId: string } — host removes the moderator.
// GET — list moderators for the show.
const Add = z.object({ handle: z.string().min(1).max(60) });
const Remove = z.object({ userId: z.string().uuid() });

async function isHost(showId: string, userId: string): Promise<boolean> {
  const s = await prisma.show.findUnique({
    where: { id: showId },
    select: { sellerId: true },
  });
  return !!s && s.sellerId === userId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mods = await prisma.showModerator.findMany({
    where: { showId: id },
    include: { user: { select: { id: true, handle: true, name: true } } },
  });
  return NextResponse.json({
    items: mods.map((m) => ({
      userId: m.user.id,
      handle: m.user.handle,
      name: m.user.name,
    })),
  });
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
  if (!(await isHost(id, session.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const handle = parsed.data.handle.trim().toLowerCase().replace(/^@/, "");
  const u = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (!u) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  await prisma.showModerator.upsert({
    where: { showId_userId: { showId: id, userId: u.id } },
    update: {},
    create: { showId: id, userId: u.id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await isHost(id, session.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await prisma.showModerator
    .delete({
      where: {
        showId_userId: { showId: id, userId: parsed.data.userId },
      },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
