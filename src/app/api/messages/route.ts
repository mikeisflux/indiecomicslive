import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateConversation } from "@/lib/dm";

export const runtime = "nodejs";

const Body = z.object({
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

// POST /api/messages
// Send a DM. Finds (or creates) the Conversation between the current
// user and recipient, appends a Message, bumps the conversation's
// lastMessageAt + preview.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (parsed.data.recipientId === session.user.id) {
    return NextResponse.json(
      { error: "self_message", message: "Can't message yourself." },
      { status: 400 },
    );
  }

  const recipient = await prisma.user.findUnique({
    where: { id: parsed.data.recipientId },
    select: { id: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "recipient_not_found" }, { status: 404 });
  }

  const conversationId = await findOrCreateConversation(
    session.user.id,
    parsed.data.recipientId,
  );

  const preview = parsed.data.body.replace(/\s+/g, " ").slice(0, 140);

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        body: parsed.data.body,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: m.createdAt,
        lastMessagePreview: preview,
      },
    });
    return m;
  });

  return NextResponse.json({
    ok: true,
    conversationId,
    messageId: message.id,
  });
}
