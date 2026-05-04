import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewerNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

async function isAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return u?.role === "admin" || u?.role === "super_admin";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(session.user.id))) {
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
          reviewedById: session.user.id,
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
          approvedById: session.user.id,
          storeName: app.storeName,
          bio: app.storeBio,
        },
        create: {
          userId: app.userId,
          storeName: app.storeName,
          bio: app.storeBio,
          approved: true,
          approvedAt: new Date(),
          approvedById: session.user.id,
        },
      });
    });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  await prisma.sellerApplication.update({
    where: { id: app.id },
    data: {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      reviewerNotes: parsed.data.reviewerNotes,
      rejectionReason: parsed.data.rejectionReason ?? "manual_rejection",
    },
  });

  return NextResponse.json({ ok: true, status: "rejected" });
}
