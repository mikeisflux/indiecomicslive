import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Service-worker fetch target. Returns the most recent unread
// notification for the authenticated user (or null). The SW pulls
// this on every push event so we can keep the push body empty (no
// payload encryption) while still showing personalized OS-level
// notifications.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ notification: null });
  }
  const n = await prisma.notification.findFirst({
    where: { userId: session.user.id, readAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    {
      notification: n
        ? { id: n.id, title: n.title, body: n.body, url: n.url }
        : null,
    },
    {
      headers: {
        // Fresh on every push — no caching layer in front of this.
        "cache-control": "no-store",
      },
    },
  );
}
