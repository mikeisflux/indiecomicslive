import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const block = await prisma.iPBlocklist.findUnique({ where: { id } });
  if (!block) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.iPBlocklist.delete({ where: { id } });
  await logAudit({
    actorId: me.id,
    action: "ip.unblock",
    targetKind: "ip",
    targetId: id,
    metadata: { ipAddress: block.ipAddress },
  });
  return NextResponse.json({ ok: true });
}
