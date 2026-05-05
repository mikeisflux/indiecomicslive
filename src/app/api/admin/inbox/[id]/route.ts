import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { r2DeleteObject } from "@/lib/r2";

const PatchBody = z
  .object({
    starred: z.boolean(),
    archived: z.boolean(),
    read: z.boolean(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof parsed.data.starred === "boolean") data.starred = parsed.data.starred;
  if (typeof parsed.data.archived === "boolean") {
    data.archivedAt = parsed.data.archived ? new Date() : null;
  }
  if (typeof parsed.data.read === "boolean") {
    data.readAt = parsed.data.read ? new Date() : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }
  await prisma.inboundEmail.update({ where: { id }, data });
  await logAudit({
    actorId: me.id,
    action: "inbox.update",
    targetKind: "inbound_email",
    targetId: id,
    metadata: parsed.data,
  });
  return NextResponse.json({ ok: true });
}

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
    select: {
      id: true,
      fromEmail: true,
      subject: true,
      attachments: { select: { r2Key: true } },
    },
  });
  if (!email) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Best-effort: drop attachments from R2 alongside the row (Prisma's
  // onDelete: Cascade handles the DB-side cleanup).
  for (const att of email.attachments) {
    await r2DeleteObject(att.r2Key);
  }
  await prisma.inboundEmail.delete({ where: { id } });
  await logAudit({
    actorId: me.id,
    action: "inbox.delete",
    targetKind: "inbound_email",
    targetId: id,
    metadata: {
      from: email.fromEmail,
      subject: email.subject,
      attachments: email.attachments.length,
    },
  });
  return NextResponse.json({ ok: true });
}
