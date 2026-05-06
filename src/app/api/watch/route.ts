import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/watch
// Toggle (or set explicitly via `watch`) the current user's watchlist
// entry for a lot or show.
//   { kind: "lot" | "show", id: <uuid>, watch?: boolean }
// → { watching: boolean }
const Body = z.object({
  kind: z.enum(["lot", "show"]),
  id: z.string().uuid(),
  watch: z.boolean().optional(),
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
  const { kind, id, watch } = parsed.data;
  const userId = session.user.id;

  // Resolve current state so toggle works without an explicit `watch`.
  let isCurrentlyWatched = false;
  if (kind === "lot") {
    const row = await prisma.watchedLot.findUnique({
      where: { userId_lotId: { userId, lotId: id } },
    });
    isCurrentlyWatched = !!row;
  } else {
    const row = await prisma.watchedShow.findUnique({
      where: { userId_showId: { userId, showId: id } },
    });
    isCurrentlyWatched = !!row;
  }
  const desired = typeof watch === "boolean" ? watch : !isCurrentlyWatched;

  if (kind === "lot") {
    if (desired && !isCurrentlyWatched) {
      // Confirm the lot exists before bookmarking.
      const lot = await prisma.lot.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!lot) {
        return NextResponse.json({ error: "lot_not_found" }, { status: 404 });
      }
      await prisma.watchedLot.create({ data: { userId, lotId: id } });
    } else if (!desired && isCurrentlyWatched) {
      await prisma.watchedLot.delete({
        where: { userId_lotId: { userId, lotId: id } },
      });
    }
  } else {
    if (desired && !isCurrentlyWatched) {
      const show = await prisma.show.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!show) {
        return NextResponse.json({ error: "show_not_found" }, { status: 404 });
      }
      await prisma.watchedShow.create({ data: { userId, showId: id } });
    } else if (!desired && isCurrentlyWatched) {
      await prisma.watchedShow.delete({
        where: { userId_showId: { userId, showId: id } },
      });
    }
  }

  return NextResponse.json({ watching: desired });
}
