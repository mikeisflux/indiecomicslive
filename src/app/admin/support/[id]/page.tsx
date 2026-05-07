import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import AdminTicketReply from "./AdminTicketReply";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ticket — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/admin/support");
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, handle: true } } },
      },
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          email: true,
          createdAt: true,
        },
      },
      order: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          lot: { select: { title: true } },
        },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
        <Link
          href="/admin/support"
          className="text-sm text-paper/60 hover:text-paper"
        >
          ← Support
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
                {m.fromAdmin
                  ? "Staff · " +
                    (m.user.name ?? `@${m.user.handle ?? "admin"}`)
                  : "Buyer · " +
                    (m.user.name ?? `@${m.user.handle ?? "user"}`)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-paper/90">
                {m.body}
              </p>
              <p className="mt-1 text-[10px] text-paper/40">
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>

        <AdminTicketReply id={ticket.id} currentStatus={ticket.status} />
      </div>

      <aside className="space-y-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-paper/40">
            Buyer
          </h3>
          <p className="mt-1 font-semibold">
            {ticket.user.name ?? `@${ticket.user.handle ?? "user"}`}
          </p>
          <p className="text-xs text-paper/60">{ticket.user.email}</p>
          <Link
            href={`/admin/users/${ticket.user.id}`}
            className="mt-2 inline-flex text-xs text-accent hover:underline"
          >
            User profile →
          </Link>
        </div>
        {ticket.order && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-paper/40">
              Linked order
            </h3>
            <p className="mt-1 line-clamp-1 font-semibold">
              {ticket.order.lot?.title ?? "(untitled)"}
            </p>
            <p className="text-xs text-paper/60">
              ${(ticket.order.amountCents / 100).toFixed(2)} ·{" "}
              {ticket.order.status}
            </p>
            <Link
              href={`/admin/orders/${ticket.order.id}`}
              className="mt-2 inline-flex text-xs text-accent hover:underline"
            >
              Order detail →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
