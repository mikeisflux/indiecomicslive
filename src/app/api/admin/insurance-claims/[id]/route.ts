import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH /api/admin/insurance-claims/[id] — admin approves, denies, or
// marks paid. Body: { status, decisionNote? }.
const Body = z.object({
  status: z.enum(["open", "approved", "denied", "paid"]),
  decisionNote: z.string().max(2000).optional().nullable(),
});

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
  const existing = await prisma.insuranceClaim.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const terminal =
    parsed.data.status === "approved" ||
    parsed.data.status === "denied" ||
    parsed.data.status === "paid";
  await prisma.insuranceClaim.update({
    where: { id },
    data: {
      status: parsed.data.status,
      decisionNote: parsed.data.decisionNote ?? existing.decisionNote,
      decidedAt: terminal ? new Date() : null,
      decidedById: terminal ? me.id : null,
    },
  });
  await logAudit({
    actorId: me.id,
    action: "insurance.update",
    targetKind: "insurance_claim",
    targetId: id,
    metadata: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
