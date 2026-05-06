import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DM_LIMIT = 30;
const DM_WINDOW_MS = 60_000;

// GET /api/messages/[id] — fetch a conversation with messages, mark
// any unread (sent by the other party) as read.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      participantA: { select: { id: true, name: true, handle: true, image: true } },
      participantB: { select: { id: true, name: true, handle: true, image: true } },
    },
  });
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const meId = session.user.id;
  if (convo.participantAId !== meId && convo.participantBId !== meId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Mark messages from the other party as read.
  await prisma.message.updateMany({
    where: { conversationId: id, senderId: { not: meId }, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({
    id: convo.id,
    otherUser:
      convo.participantAId === meId ? convo.participantB : convo.participantA,
    messages: convo.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

// POST /api/messages/[id] — append a message to an existing
// conversation (subset of POST /api/messages, faster path when the
// conversation id is already known).
const Body = z.object({ body: z.string().min(1).max(4000) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const meId = session.user.id;

  const rl = checkRateLimit(`dm:${meId}`, DM_LIMIT, DM_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `You're sending messages too fast. Try again in ${Math.ceil((rl.retryMs ?? 1000) / 1000)}s.`,
      },
      { status: 429, headers: { "retry-after": String(Math.ceil((rl.retryMs ?? 1000) / 1000)) } },
    );
  }

  const convo = await prisma.conversation.findUnique({ where: { id } });
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (convo.participantAId !== meId && convo.participantBId !== meId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const preview = parsed.data.body.replace(/\s+/g, " ").slice(0, 140);
  const m = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId: id,
        senderId: meId,
        body: parsed.data.body,
      },
    });
    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: m.createdAt, lastMessagePreview: preview },
    });
    return m;
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    },
  });
}
