import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listConversationsForUser } from "@/lib/dm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/messages");
  const convos = await listConversationsForUser(session.user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Buyer Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Messages</h1>
      <p className="mt-1 text-sm text-paper/60">
        Direct messages with other users on Indie Comics Live.
      </p>

      {convos.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
          No conversations yet. Start one by hitting &ldquo;Message
          seller&rdquo; on a seller&rsquo;s shop page.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {convos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/account/messages/${c.id}`}
                className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.04] ${
                  c.unread ? "bg-accent/5" : ""
                }`}
              >
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  {c.otherUser.image ? (
                    <Image
                      src={c.otherUser.image}
                      alt=""
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {c.otherUser.name ??
                      (c.otherUser.handle
                        ? `@${c.otherUser.handle}`
                        : c.otherUser.email ?? "(user)")}
                    {c.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </p>
                  <p className="truncate text-xs text-paper/60">
                    {c.lastMessagePreview ?? "(no messages yet)"}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-paper/40">
                  {new Date(c.lastMessageAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
