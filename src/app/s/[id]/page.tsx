import { notFound } from "next/navigation";
import { db, shows, lots, users } from "@/db";
import { and, asc, eq, ne } from "drizzle-orm";
import ShowRoom from "./ShowRoom";

export const dynamic = "force-dynamic";

export default async function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [show] = await db.select().from(shows).where(eq(shows.id, id)).limit(1);
  if (!show) notFound();

  const [seller] = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, show.sellerId));

  const showLots = await db
    .select()
    .from(lots)
    .where(and(eq(lots.showId, show.id), ne(lots.status, "unsold")))
    .orderBy(asc(lots.position));

  const liveLot = showLots.find((l) => l.status === "live") ?? null;

  return (
    <ShowRoom
      show={{
        id: show.id,
        title: show.title,
        status: show.status,
        muxPlaybackId: show.muxPlaybackId,
      }}
      seller={seller ?? null}
      liveLot={liveLot}
      queuedLots={showLots.filter((l) => l.status === "queued")}
    />
  );
}
