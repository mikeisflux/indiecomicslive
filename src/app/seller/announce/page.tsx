import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AnnounceForm from "./AnnounceForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Announce to followers — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function AnnouncePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/seller/announce");

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { approved: true },
  });
  if (!seller?.approved) redirect("/sell");

  const [followerCount, recent] = await Promise.all([
    prisma.follow.count({ where: { sellerId: session.user.id } }),
    prisma.sellerBroadcast.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link
        href="/seller"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Seller hub
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Announce to followers</h1>
      <p className="mt-1 text-sm text-paper/60">
        Send a push + email to your{" "}
        <span className="text-paper">{followerCount.toLocaleString()}</span>{" "}
        follower{followerCount === 1 ? "" : "s"}. Capped at one blast per
        hour to keep your fans happy.
      </p>

      <AnnounceForm />

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-paper/40">
            Recent
          </h2>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
            {recent.map((b) => (
              <li key={b.id} className="px-4 py-3 text-sm">
                <p className="font-semibold">{b.subject}</p>
                <p className="line-clamp-2 text-xs text-paper/60">{b.body}</p>
                <p className="mt-1 text-[10px] text-paper/40">
                  {new Date(b.createdAt).toLocaleString()} ·{" "}
                  {b.recipients.toLocaleString()} recipients
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
