import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your orders — Indie Comics Live",
};

export default async function OrdersPage() {
  const me = await requireOnboardedUser("/orders");

  const orders = await prisma.order.findMany({
    where: { buyerId: me.id },
    orderBy: { createdAt: "desc" },
    include: {
      lot: { select: { title: true, imageUrl: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <h1 className="mb-6 text-2xl font-bold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="text-paper/50">
          You haven&rsquo;t won anything yet.{" "}
          <Link href="/" className="text-accent">
            Browse live shows.
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 py-3"
              >
                {o.lot.imageUrl ? (
                  <img
                    src={o.lot.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.lot.title}</p>
                  <p className="text-xs text-paper/60">
                    ${(o.amountCents / 100).toFixed(2)} · {o.status}
                  </p>
                </div>
                <span className="text-xs text-paper/40">
                  {new Date(o.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
