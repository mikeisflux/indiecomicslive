import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST — clone the most recently-sold lot from this show into a new
// queued lot at the end of the queue. Used mid-stream for the
// "run it again" pattern.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  });
  if (!show || show.sellerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const last = await prisma.lot.findFirst({
    where: { showId: id, status: "sold" },
    orderBy: { soldAt: "desc" },
    include: { images: true },
  });
  if (!last) {
    return NextResponse.json({ error: "no_sold_lot" }, { status: 404 });
  }
  const maxPos = await prisma.lot.aggregate({
    where: { showId: id },
    _max: { position: true },
  });
  const next = (maxPos._max.position ?? 0) + 1;
  const cloned = await prisma.lot.create({
    data: {
      showId: id,
      sellerId: last.sellerId,
      categoryId: last.categoryId,
      tags: last.tags,
      position: next,
      kind: last.kind,
      title: last.title,
      description: last.description,
      imageUrl: last.imageUrl,
      startingBidCents: last.startingBidCents,
      minIncrementCents: last.minIncrementCents,
      softCloseSeconds: last.softCloseSeconds,
      buyNowCents: last.buyNowCents,
      inventoryCount: last.inventoryCount,
      shippingCostCents: last.shippingCostCents,
      mysteryContentsHtml: last.mysteryContentsHtml,
      mysteryItemCount: last.mysteryItemCount,
      packSpots: last.packSpots,
      flashDurationSeconds: last.flashDurationSeconds,
      status: "queued",
      images: {
        create: last.images.map((im) => ({
          url: im.url,
          position: im.position,
        })),
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: cloned.id });
}
