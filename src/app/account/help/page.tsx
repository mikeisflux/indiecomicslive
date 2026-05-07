import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HelpForm from "./HelpForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Help — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/help");

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Buyer Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Help</h1>
      <p className="mt-1 text-sm text-paper/60">
        Reach our team. Real humans answer — average response under 24 hours.
      </p>

      <HelpForm />

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/40">
          Your tickets
        </h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-paper/50">No tickets yet.</p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/account/help/${t.id}`}
                  className="block px-4 py-3 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        t.status === "resolved" || t.status === "closed"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : t.status === "awaiting_user"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-accent/20 text-accent"
                      }`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                    <p className="line-clamp-1 flex-1 text-sm font-semibold">
                      {t.subject}
                    </p>
                    <p className="shrink-0 text-xs text-paper/50">
                      {t._count.messages} msg ·{" "}
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
