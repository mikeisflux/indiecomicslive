import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/push/subscribe — register a Web Push subscription for
// the current user. Idempotent on the endpoint URL (if it already
// belongs to a different user we move it; the same user re-subscribes
// without creating a duplicate). DELETE removes by endpoint.
const Body = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(10).max(512),
  authKey: z.string().min(10).max(256),
  userAgent: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { endpoint, p256dh, authKey, userAgent } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.user.id,
      p256dh,
      authKey,
      userAgent: userAgent ?? null,
    },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh,
      authKey,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { endpoint } = await req.json().catch(() => ({ endpoint: "" }));
  if (!endpoint) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await prisma.pushSubscription
    .deleteMany({
      where: { endpoint, userId: session.user.id },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
