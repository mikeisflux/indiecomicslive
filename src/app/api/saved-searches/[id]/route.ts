import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// DELETE /api/saved-searches/[id] — remove one of the current user's
// saved searches. 404 if it doesn't exist or belongs to someone else.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  // Ownership-scoped, idempotent delete: where filter pins userId so
  // a user can't delete someone else's row, and `deleteMany` won't
  // 500 on P2025 if a concurrent click already removed it.
  const result = await prisma.savedSearch.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
