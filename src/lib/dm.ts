import { prisma } from "@/lib/prisma";

// Sort the two user ids so we can use a unique (participantAId,
// participantBId) index instead of writing to an upsert with both
// orientations. Strings are sorted lexicographically — uuids are
// already in a stable order so this is deterministic.
export function sortedPair(
  userId1: string,
  userId2: string,
): { a: string; b: string } {
  return userId1 < userId2
    ? { a: userId1, b: userId2 }
    : { a: userId2, b: userId1 };
}

// Find or create the Conversation between two users. Race-safe via
// upsert — two concurrent calls for the same pair don't crash on the
// unique (participantAId, participantBId) constraint.
export async function findOrCreateConversation(
  meId: string,
  otherId: string,
): Promise<string> {
  const { a, b } = sortedPair(meId, otherId);
  const row = await prisma.conversation.upsert({
    where: {
      participantAId_participantBId: { participantAId: a, participantBId: b },
    },
    update: {},
    create: { participantAId: a, participantBId: b },
    select: { id: true },
  });
  return row.id;
}

export interface ConversationListRow {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
    email: string | null;
  };
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  unread: boolean;
}

// List all conversations for a user with the other party's basic info
// and a quick "unread" flag. Unread = there exists a message in this
// conversation by the OTHER user where readAt is null.
export async function listConversationsForUser(
  meId: string,
): Promise<ConversationListRow[]> {
  const convos = await prisma.conversation.findMany({
    where: {
      OR: [{ participantAId: meId }, { participantBId: meId }],
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      participantA: {
        select: { id: true, name: true, handle: true, image: true, email: true },
      },
      participantB: {
        select: { id: true, name: true, handle: true, image: true, email: true },
      },
    },
  });

  // Unread per conversation in one query.
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: convos.map((c) => c.id) },
      senderId: { not: meId },
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadMap = new Map<string, number>();
  for (const u of unreadCounts) {
    unreadMap.set(u.conversationId, u._count._all);
  }

  return convos.map((c) => ({
    id: c.id,
    otherUser:
      c.participantAId === meId ? c.participantB : c.participantA,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
    unread: (unreadMap.get(c.id) ?? 0) > 0,
  }));
}
