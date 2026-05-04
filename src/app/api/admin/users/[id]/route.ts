import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unlock"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("ban"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unban"), reason: z.string().max(500).optional() }),
  z.object({
    action: z.literal("chat_ban"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("chat_unban"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("set_role"),
    role: z.enum(["viewer", "seller", "admin", "super_admin"]),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("ip_block"),
    ip: z.string().min(3).max(64),
    reason: z.string().max(500).optional(),
  }),
]);

export async function POST(
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, lastKnownIP: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.id === me.id && parsed.data.action === "ban") {
    return NextResponse.json({ error: "cannot_ban_self" }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "lock":
      await prisma.user.update({
        where: { id },
        data: {
          lockedAt: new Date(),
          lockedById: me.id,
          lockedReason: parsed.data.reason,
        },
      });
      break;
    case "unlock":
      await prisma.user.update({
        where: { id },
        data: { lockedAt: null, lockedById: null, lockedReason: null },
      });
      break;
    case "ban":
      await prisma.user.update({
        where: { id },
        data: { bannedAt: new Date() },
      });
      break;
    case "unban":
      await prisma.user.update({ where: { id }, data: { bannedAt: null } });
      break;
    case "chat_ban":
      await prisma.user.update({
        where: { id },
        data: {
          chatBannedAt: new Date(),
          chatBannedById: me.id,
          chatBanReason: parsed.data.reason,
        },
      });
      break;
    case "chat_unban":
      await prisma.user.update({
        where: { id },
        data: {
          chatBannedAt: null,
          chatBannedById: null,
          chatBanReason: null,
        },
      });
      break;
    case "set_role":
      await prisma.user.update({
        where: { id },
        data: { role: parsed.data.role },
      });
      break;
    case "ip_block": {
      const ip = parsed.data.ip;
      await prisma.iPBlocklist.upsert({
        where: { ipAddress: ip },
        update: {
          userId: id,
          bannedById: me.id,
          reason: parsed.data.reason,
        },
        create: {
          ipAddress: ip,
          userId: id,
          bannedById: me.id,
          reason: parsed.data.reason,
        },
      });
      break;
    }
  }

  await logAudit({
    actorId: me.id,
    action: `user.${parsed.data.action}`,
    targetKind: "user",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
