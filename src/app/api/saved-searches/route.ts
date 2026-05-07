import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  query: z.string().min(2).max(200),
});

// POST /api/saved-searches — save the current query for daily-email
// follow-up. Idempotent: re-saving the same query for the same user
// just returns the existing row.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const query = parsed.data.query.trim();
  if (!query) {
    return NextResponse.json({ error: "empty_query" }, { status: 400 });
  }

  // Cap to 50 saved searches per user so a runaway client can't
  // accumulate forever.
  const count = await prisma.savedSearch.count({
    where: { userId: session.user.id },
  });
  if (count >= 50) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: "You can save up to 50 searches. Delete one first.",
      },
      { status: 409 },
    );
  }

  // Race-safe via the @@unique([userId, query]) constraint: an upsert
  // collapses concurrent submits to a single row. The composite-key
  // lookup name is `userId_query` (Prisma convention).
  const row = await prisma.savedSearch.upsert({
    where: {
      userId_query: { userId: session.user.id, query },
    },
    update: {},
    create: { userId: session.user.id, query },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
