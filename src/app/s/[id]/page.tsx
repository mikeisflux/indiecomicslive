import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordingPlaybackUrl } from "@/lib/recording-sync";
import ShowRoom from "./ShowRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      coverImageUrl: true,
      status: true,
    },
  });
  if (!show) return { title: "Show not found" };

  const liveSuffix = show.status === "live" ? " · Live now" : "";
  return {
    title: `${show.title}${liveSuffix} — Indie Comics Live`,
    description:
      show.description ??
      "Live auction on Indie Comics Live, the adult-friendly Whatnot alternative for comics and cards.",
    openGraph: {
      title: `${show.title}${liveSuffix}`,
      description: show.description ?? undefined,
      images: show.coverImageUrl ? [{ url: show.coverImageUrl }] : undefined,
      type: "video.other",
    },
  };
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          handle: true,
          name: true,
          image: true,
        },
      },
      lots: {
        where: { status: { not: "unsold" } },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!show) notFound();

  const liveLot = show.lots.find((l) => l.status === "live") ?? null;
  const queuedLots = show.lots.filter((l) => l.status === "queued");
  const pinnedLot = show.pinnedLotId
    ? show.lots.find((l) => l.id === show.pinnedLotId) ?? null
    : null;

  // Is the current viewer already watching this show? Are they the
  // host or one of the show's moderators?
  let isWatching = false;
  let canModerate = false;
  const session = await auth();
  if (session?.user?.id) {
    const [watch, mod] = await Promise.all([
      prisma.watchedShow.findUnique({
        where: {
          userId_showId: { userId: session.user.id, showId: show.id },
        },
        select: { userId: true },
      }),
      prisma.showModerator.findUnique({
        where: {
          showId_userId: { showId: show.id, userId: session.user.id },
        },
        select: { userId: true },
      }),
    ]);
    isWatching = !!watch;
    canModerate = !!mod || show.sellerId === session.user.id;
  }

  // Replay URL: only resolved when the show has ended and a
  // ShowRecording row exists. Prefers the most recent recording.
  let replayUrl: string | null = null;
  if (show.status === "ended") {
    const rec = await prisma.showRecording.findFirst({
      where: { showId: show.id },
      orderBy: { createdAt: "desc" },
      select: { r2Key: true },
    });
    if (rec) {
      replayUrl = await recordingPlaybackUrl({ r2Key: rec.r2Key });
    }
  }

  return (
    <ShowRoom
      show={{
        id: show.id,
        title: show.title,
        status: show.status,
        coverImageUrl: show.coverImageUrl,
        trailerUrl: show.trailerUrl,
        pinnedLotId: show.pinnedLotId,
        chatOverlayEnabled: show.chatOverlayEnabled,
        isWatching,
      }}
      seller={show.seller}
      liveLot={liveLot}
      pinnedLot={pinnedLot}
      queuedLots={queuedLots}
      signedIn={!!session?.user?.id}
      replayUrl={replayUrl}
      canModerate={canModerate}
    />
  );
}
