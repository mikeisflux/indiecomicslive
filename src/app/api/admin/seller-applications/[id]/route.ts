import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewerNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const app = await prisma.sellerApplication.findUnique({ where: { id } });
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (parsed.data.decision === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.sellerApplication.update({
        where: { id: app.id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedById: me.id,
          reviewerNotes: parsed.data.reviewerNotes,
        },
      });
      await tx.user.update({
        where: { id: app.userId },
        data: { role: "seller" },
      });
      await tx.seller.upsert({
        where: { userId: app.userId },
        update: {
          approved: true,
          approvedAt: new Date(),
          approvedById: me.id,
          storeName: app.storeName,
          bio: app.storeBio,
        },
        create: {
          userId: app.userId,
          storeName: app.storeName,
          bio: app.storeBio,
          approved: true,
          approvedAt: new Date(),
          approvedById: me.id,
        },
      });
    });
    await logAudit({
      actorId: me.id,
      action: "seller_application.approve",
      targetKind: "seller_application",
      targetId: app.id,
      metadata: { sellerUserId: app.userId, notes: parsed.data.reviewerNotes },
    });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  await prisma.sellerApplication.update({
    where: { id: app.id },
    data: {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedById: me.id,
      reviewerNotes: parsed.data.reviewerNotes,
      rejectionReason: parsed.data.rejectionReason ?? "manual_rejection",
    },
  });
  await logAudit({
    actorId: me.id,
    action: "seller_application.reject",
    targetKind: "seller_application",
    targetId: app.id,
    metadata: {
      sellerUserId: app.userId,
      reason: parsed.data.rejectionReason,
      notes: parsed.data.reviewerNotes,
    },
  });

  return NextResponse.json({ ok: true, status: "rejected" });
}
