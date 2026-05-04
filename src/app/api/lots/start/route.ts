import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startNextLot } from "@/lib/auction";

const Body = z.object({
  showId: z.string().uuid(),
  durationSeconds: z.number().int().min(10).max(600).optional(),
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

  const lot = await startNextLot(
    parsed.data.showId,
    parsed.data.durationSeconds ?? 30,
  );

  if (!lot) {
    return NextResponse.json({ error: "no_queued_lots" }, { status: 400 });
  }

  return NextResponse.json({ lot });
}
