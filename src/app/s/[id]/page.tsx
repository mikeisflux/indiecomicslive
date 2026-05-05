import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
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

  return (
    <ShowRoom
      show={{
        id: show.id,
        title: show.title,
        status: show.status,
        coverImageUrl: show.coverImageUrl,
      }}
      seller={show.seller}
      liveLot={liveLot}
      queuedLots={queuedLots}
    />
  );
}
