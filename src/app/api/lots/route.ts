import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const Body = z.object({
  showId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  startingBidCents: z.number().int().nonnegative(),
  minIncrementCents: z.number().int().positive().optional(),
  softCloseSeconds: z.number().int().min(3).max(60).optional(),
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

  const show = await prisma.show.findUnique({
    where: { id: parsed.data.showId },
    select: { sellerId: true },
  });

  if (!show || show.sellerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const max = await prisma.lot.aggregate({
    where: { showId: parsed.data.showId },
    _max: { position: true },
  });
  const nextPos = (max._max.position ?? 0) + 1;

  const lot = await prisma.lot.create({
    data: {
      showId: parsed.data.showId,
      position: nextPos,
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      startingBidCents: parsed.data.startingBidCents,
      minIncrementCents: parsed.data.minIncrementCents ?? 100,
      softCloseSeconds: parsed.data.softCloseSeconds ?? 10,
    },
  });

  return NextResponse.json({ lot });
}
