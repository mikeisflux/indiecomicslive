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
  const description =
    show.description ??
    "Live auction on Indie Comics Live, the adult-friendly Whatnot alternative for comics and cards.";
  // No `images` set here — Next picks up /s/[id]/opengraph-image.tsx
  // automatically and uses it for og:image + twitter:image.
  return {
    title: `${show.title}${liveSuffix} — Indie Comics Live`,
    description,
    alternates: { canonical: `/s/${id}` },
    openGraph: {
      title: `${show.title}${liveSuffix}`,
      description,
      type: "video.other",
      url: `/s/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${show.title}${liveSuffix}`,
      description,
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

  // Replay URL + chapter markers. Only resolved when the show has
  // ended and a ShowRecording row exists. Chapters are derived from
  // each lot's startedAt offset relative to show.startedAt.
  let replayUrl: string | null = null;
  let chapters: { lotId: string; title: string; offsetSec: number }[] = [];
  if (show.status === "ended") {
    const rec = await prisma.showRecording.findFirst({
      where: { showId: show.id },
      orderBy: { createdAt: "desc" },
      select: { r2Key: true },
    });
    if (rec) {
      replayUrl = await recordingPlaybackUrl({ r2Key: rec.r2Key });
    }
    if (replayUrl && show.startedAt) {
      const showStart = show.startedAt.getTime();
      chapters = show.lots
        .filter((l) => l.startedAt)
        .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime())
        .map((l) => ({
          lotId: l.id,
          title: l.title,
          offsetSec: Math.max(
            0,
            Math.floor((l.startedAt!.getTime() - showStart) / 1000),
          ),
        }));
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
      replayChapters={chapters}
      canModerate={canModerate}
    />
  );
}
