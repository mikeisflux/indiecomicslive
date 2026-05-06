import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

export const runtime = "nodejs";

const Body = z.object({
  status: z
    .enum(["open", "under_review", "resolved", "closed_no_action"])
    .optional(),
  resolution: z.string().max(5000).nullable().optional(),
});

// PATCH /api/admin/disputes/[id] — admin updates the dispute's
// status / resolution notes. Sets resolvedAt + resolvedById when
// transitioning to a terminal status.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const existing = await prisma.orderDispute.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    if (parsed.data.status === "resolved" || parsed.data.status === "closed_no_action") {
      data.resolvedAt = new Date();
      data.resolvedById = me.id;
    } else {
      // Re-opening or moving back to under_review clears the
      // resolved bookkeeping.
      data.resolvedAt = null;
      data.resolvedById = null;
    }
  }
  if (parsed.data.resolution !== undefined) {
    data.resolution = parsed.data.resolution;
  }

  await prisma.orderDispute.update({ where: { id }, data });

  await logAudit({
    actorId: me.id,
    action: "dispute.update",
    targetKind: "order_dispute",
    targetId: id,
    metadata: data,
  });

  return NextResponse.json({ ok: true });
}
