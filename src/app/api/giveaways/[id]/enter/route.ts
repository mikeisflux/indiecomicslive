import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST — viewer enters a giveaway. Idempotent.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const g = await prisma.giveaway.findUnique({
    where: { id },
    select: { status: true, closesAt: true },
  });
  if (!g) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (g.status !== "open") {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }
  if (g.closesAt && g.closesAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }
  await prisma.giveawayEntry.upsert({
    where: {
      giveawayId_userId: { giveawayId: id, userId: session.user.id },
    },
    update: {},
    create: { giveawayId: id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
