import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/follow — toggle following a seller. Body:
//   { sellerId: string, follow?: boolean }
// If `follow` is omitted, toggles. Idempotent for both directions.
const Body = z.object({
  sellerId: z.string().uuid(),
  follow: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { sellerId, follow } = parsed.data;
  if (sellerId === session.user.id) {
    return NextResponse.json(
      { error: "cant_follow_self" },
      { status: 400 },
    );
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_sellerId: { followerId: session.user.id, sellerId },
    },
    select: { followerId: true },
  });
  const want = follow === undefined ? !existing : follow;

  // Use upsert / deleteMany so two concurrent toggles from the same
  // user can't trip the unique constraint with a 500.
  if (want) {
    await prisma.follow.upsert({
      where: {
        followerId_sellerId: { followerId: session.user.id, sellerId },
      },
      update: {},
      create: { followerId: session.user.id, sellerId },
    });
  } else {
    await prisma.follow.deleteMany({
      where: { followerId: session.user.id, sellerId },
    });
  }
  return NextResponse.json({ ok: true, following: want });
}
