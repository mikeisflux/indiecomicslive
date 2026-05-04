import Link from "next/link";
import { db, shows } from "@/db";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewShowForm from "./NewShowForm";

export const dynamic = "force-dynamic";

export default async function SellerDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const myShows = await db
    .select()
    .from(shows)
    .where(eq(shows.sellerId, session.user.id))
    .orderBy(desc(shows.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <h1 className="mb-6 text-2xl font-bold">Seller dashboard</h1>

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
              <li key={s.id} className="flex items-center justify-between py-3">
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
