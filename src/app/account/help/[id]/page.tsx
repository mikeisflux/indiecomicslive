import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TicketReply from "./TicketReply";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ticket — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/account/help/${id}`);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, handle: true } } },
      },
    },
  });
  if (!ticket || ticket.userId !== session.user.id) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link
        href="/account/help"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Help
      </Link>
      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
            ticket.status === "resolved" || ticket.status === "closed"
              ? "bg-emerald-500/20 text-emerald-300"
              : ticket.status === "awaiting_user"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-accent/20 text-accent"
          }`}
        >
          {ticket.status.replace("_", " ")}
        </span>
      </div>

      <ul className="mt-6 space-y-3">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl p-4 text-sm ${
              m.fromAdmin
                ? "icl-glass-accent"
                : "border border-white/10 bg-white/[0.02]"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-paper/50">
              {m.fromAdmin ? "Indie Comics Live · staff" : "You"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-paper/90">{m.body}</p>
            <p className="mt-1 text-[10px] text-paper/40">
              {new Date(m.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {ticket.status !== "closed" && <TicketReply id={ticket.id} />}
    </main>
  );
}
