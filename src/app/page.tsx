import Link from "next/link";
import Image from "next/image";
import { db, shows, users } from "@/db";
import { desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getLiveAndUpcoming() {
  const rows = await db
    .select({
      id: shows.id,
      title: shows.title,
      status: shows.status,
      coverImageUrl: shows.coverImageUrl,
      streamId: shows.streamId,
      scheduledFor: shows.scheduledFor,
      sellerId: shows.sellerId,
    })
    .from(shows)
    .where(inArray(shows.status, ["live", "scheduled"]))
    .orderBy(desc(shows.status), desc(shows.scheduledFor))
    .limit(40);

  if (rows.length === 0) return [];

  const sellerIds = [...new Set(rows.map((r) => r.sellerId))];
  const sellers = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
    })
    .from(users)
    .where(inArray(users.id, sellerIds));
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));

  return rows.map((r) => ({
    ...r,
    seller: sellerMap.get(r.sellerId),
  }));
}

export default async function Home() {
  const list = await getLiveAndUpcoming().catch(() => []);
  const live = list.filter((s) => s.status === "live");
  const upcoming = list.filter((s) => s.status === "scheduled");

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Indie Comics <span className="text-accent">Live</span>
        </h1>
        <Link
          href="/sign-in"
          className="rounded-full border border-white/10 px-4 py-2 text-sm"
        >
          Sign in
        </Link>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Live now
        </h2>
        {live.length === 0 ? (
          <p className="text-paper/50">No streams live right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((s) => (
              <ShowCard key={s.id} show={s} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Scheduled
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-paper/50">Nothing scheduled.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((s) => (
              <ShowCard key={s.id} show={s} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ShowCard({
  show,
}: {
  show: {
    id: string;
    title: string;
    status: string;
    coverImageUrl: string | null;
    scheduledFor: Date | null;
    seller?: { handle: string | null; name: string | null };
  };
}) {
  return (
    <Link
      href={`/s/${show.id}`}
      className="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition hover:border-white/20"
    >
      <div className="relative aspect-video bg-black/60">
        {show.coverImageUrl ? (
          <Image
            src={show.coverImageUrl}
            alt={show.title}
            fill
            className="object-cover"
          />
        ) : null}
        {show.status === "live" && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase">
            Live
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-semibold">{show.title}</p>
        <p className="text-xs text-paper/60">
          @{show.seller?.handle ?? "unknown"}
          {show.scheduledFor && show.status === "scheduled"
            ? ` · ${new Date(show.scheduledFor).toLocaleString()}`
            : null}
        </p>
      </div>
    </Link>
  );
}
