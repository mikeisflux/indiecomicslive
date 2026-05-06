import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/notifications — list (most recent 50). Used by the bell
// dropdown.
// PATCH /api/notifications — body { ids: string[] } marks read; if
// ids is omitted, marks ALL of the user's unread as read.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], unread: 0 });
  }
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);
  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unread,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ids } = await req.json().catch(() => ({ ids: undefined }));
  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
      ...(Array.isArray(ids) && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
