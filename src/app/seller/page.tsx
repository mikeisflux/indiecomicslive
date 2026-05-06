import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import NewShowForm from "./NewShowForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller dashboard — Indie Comics Live",
};

export default async function SellerDashboard() {
  const me = await requireOnboardedUser("/seller");

  const myShows = await prisma.show.findMany({
    where: { sellerId: me.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <h1 className="mb-6 text-2xl font-bold">Seller dashboard</h1>

      <div className="mb-8 grid gap-2 sm:grid-cols-3">
        <Link
          href="/seller/shop"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm hover:bg-white/[0.04]"
        >
          <p className="font-semibold">24/7 Shop →</p>
          <p className="mt-1 text-xs text-paper/60">
            List Buy-Now and Mystery items that sell any time, no live show
            needed.
          </p>
        </Link>
        <Link
          href="/seller/orders"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm hover:bg-white/[0.04]"
        >
          <p className="font-semibold">Orders →</p>
          <p className="mt-1 text-xs text-paper/60">
            Print labels, track shipments, see delivered orders awaiting payout.
          </p>
        </Link>
        <Link
          href="/seller/stats"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm hover:bg-white/[0.04]"
        >
          <p className="font-semibold">Stats →</p>
          <p className="mt-1 text-xs text-paper/60">
            Gross, fees, net, top lots, and the daily sales sparkline.
          </p>
        </Link>
      </div>

      <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          New show
        </h2>
        <NewShowForm />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Your shows
        </h2>
        {myShows.length === 0 ? (
          <p className="text-paper/50">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {myShows.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-paper/60">
                    {s.status} · {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/seller/${s.id}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
