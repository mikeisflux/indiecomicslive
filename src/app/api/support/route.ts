import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/support — open a support ticket. Optionally attach to an
// order id for context. The first message in the thread is the body
// the buyer typed in the form.
const Body = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  orderId: z.string().uuid().optional().nullable(),
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
  // Light rate-limit: max 3 open/awaiting tickets per user. Stops
  // accidental duplicate submissions and the obvious spam vector.
  const openCount = await prisma.supportTicket.count({
    where: {
      userId: session.user.id,
      status: { in: ["open", "awaiting_user"] },
    },
  });
  if (openCount >= 3) {
    return NextResponse.json(
      {
        error: "too_many_open",
        message: "You already have 3 open tickets. Reply on one of those.",
      },
      { status: 429 },
    );
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      subject: parsed.data.subject,
      orderId: parsed.data.orderId ?? null,
      messages: {
        create: {
          userId: session.user.id,
          body: parsed.data.body,
          fromAdmin: false,
        },
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: ticket.id });
}

// GET /api/support — list the current user's tickets.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }
  const items = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json({
    items: items.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      orderId: t.orderId,
      messageCount: t._count.messages,
      updatedAt: t.updatedAt,
    })),
  });
}
