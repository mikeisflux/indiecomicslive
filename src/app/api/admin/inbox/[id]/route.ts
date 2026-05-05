import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const email = await prisma.inboundEmail.findUnique({
    where: { id },
    select: { id: true, fromEmail: true, subject: true },
  });
  if (!email) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.inboundEmail.delete({ where: { id } });
  await logAudit({
    actorId: me.id,
    action: "inbox.delete",
    targetKind: "inbound_email",
    targetId: id,
    metadata: { from: email.fromEmail, subject: email.subject },
  });
  return NextResponse.json({ ok: true });
}
