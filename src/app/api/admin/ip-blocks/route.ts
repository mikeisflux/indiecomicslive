import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

const Body = z.object({
  ipAddress: z.string().min(3).max(64),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const block = await prisma.iPBlocklist.upsert({
    where: { ipAddress: parsed.data.ipAddress },
    update: {
      reason: parsed.data.reason,
      bannedById: me.id,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    create: {
      ipAddress: parsed.data.ipAddress,
      reason: parsed.data.reason,
      bannedById: me.id,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  await logAudit({
    actorId: me.id,
    action: "ip.block",
    targetKind: "ip",
    targetId: block.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ block });
}
