import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setAutoBid } from "@/lib/auction";

export const runtime = "nodejs";

// POST /api/lots/[id]/auto-bid — set or update a max-bid proxy.
// Body: { maxDollars: number }   (we accept dollars to keep the UI
// simple; convert to cents server-side).
// DELETE /api/lots/[id]/auto-bid — cancel.
const Body = z.object({
  maxDollars: z.number().min(1).max(1_000_000),
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
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const r = await setAutoBid({
    lotId: id,
    userId: session.user.id,
    maxAmountCents: Math.round(parsed.data.maxDollars * 100),
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.autoBid
    .updateMany({
      where: { lotId: id, userId: session.user.id },
      data: { active: false },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
