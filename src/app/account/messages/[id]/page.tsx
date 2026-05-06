import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ThreadView from "./ThreadView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conversation — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/messages");
  const { id } = await params;

  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      participantA: { select: { id: true, name: true, handle: true, image: true } },
      participantB: { select: { id: true, name: true, handle: true, image: true } },
    },
  });
  if (!convo) notFound();
  const meId = session.user.id;
  if (convo.participantAId !== meId && convo.participantBId !== meId) notFound();

  // Mark unread (from the other party) as read on view.
  await prisma.message.updateMany({
    where: { conversationId: id, senderId: { not: meId }, readAt: null },
    data: { readAt: new Date() },
  });

  const otherUser =
    convo.participantAId === meId ? convo.participantB : convo.participantA;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link
        href="/account/messages"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Messages
      </Link>
      <header className="mt-3 flex items-center gap-3">
        <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
          {otherUser.image ? (
            <Image
              src={otherUser.image}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : null}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">
            {otherUser.name ??
              (otherUser.handle ? `@${otherUser.handle}` : "(user)")}
          </h1>
          {otherUser.handle && (
            <Link
              href={`/shop/${otherUser.handle}`}
              className="text-xs text-paper/50 hover:text-paper"
            >
              View shop →
            </Link>
          )}
        </div>
      </header>

      <ThreadView
        conversationId={id}
        meId={meId}
        initial={convo.messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
