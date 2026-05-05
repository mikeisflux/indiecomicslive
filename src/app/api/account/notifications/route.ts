import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { subscribed?: boolean } | null;
  if (!body || typeof body.subscribed !== "boolean") {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      emailUnsubscribedAt: body.subscribed ? null : new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
