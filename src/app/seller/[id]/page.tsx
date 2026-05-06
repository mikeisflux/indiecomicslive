import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import SellerControls from "./SellerControls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage show — Indie Comics Live",
};

export default async function SellerShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireOnboardedUser(`/seller/${id}`);

  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      lots: { orderBy: { position: "asc" } },
    },
  });
  if (!show) notFound();
  if (show.sellerId !== me.id) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <h1 className="mb-1 text-2xl font-bold">{show.title}</h1>
      <p className="mb-6 text-xs text-paper/60">{show.status}</p>
      <SellerControls
        show={{
          id: show.id,
          status: show.status,
          pinnedLotId: show.pinnedLotId,
          chatOverlayEnabled: show.chatOverlayEnabled,
        }}
        initialLots={show.lots.map((l) => ({
          id: l.id,
          position: l.position,
          title: l.title,
          imageUrl: l.imageUrl,
          startingBidCents: l.startingBidCents,
          minIncrementCents: l.minIncrementCents,
          status: l.status,
          currentBidCents: l.currentBidCents,
          bidCount: l.bidCount,
        }))}
      />
    </main>
  );
}
