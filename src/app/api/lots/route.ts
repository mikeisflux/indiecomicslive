import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sanitizeMysteryHtml } from "@/lib/html-sanitize";

// Lot kinds:
//   auction  — timed bidding (existing behavior). Requires showId.
//   buy_now  — fixed price, first buyer wins. showId optional;
//              omitting it places the lot in the seller's 24/7 shop.
//   mystery  — buy-now flow with hidden contents.
const Body = z
  .object({
    showId: z.string().uuid().nullable().optional(),
    kind: z.enum(["auction", "buy_now", "mystery"]).default("auction"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    startingBidCents: z.number().int().nonnegative().optional(),
    minIncrementCents: z.number().int().positive().optional(),
    softCloseSeconds: z.number().int().min(3).max(60).optional(),
    buyNowCents: z.number().int().positive().optional(),
    inventoryCount: z.number().int().positive().optional(),
    // Mystery-only: revealed-on-purchase contents.
    mysteryContentsHtml: z.string().max(50_000).optional(),
    mysteryItemCount: z.number().int().positive().max(50).optional(),
  })
  .refine(
    (d) =>
      d.kind === "auction" ||
      (typeof d.buyNowCents === "number" && d.buyNowCents > 0),
    { message: "buyNowCents required for buy_now / mystery lots", path: ["buyNowCents"] },
  )
  .refine((d) => d.kind !== "auction" || !!d.showId, {
    message: "auction lots require a showId",
    path: ["showId"],
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  let sellerId: string;
  let nextPos: number;

  if (parsed.data.showId) {
    const show = await prisma.show.findUnique({
      where: { id: parsed.data.showId },
      select: { sellerId: true },
    });
    if (!show || show.sellerId !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    sellerId = show.sellerId;
    const max = await prisma.lot.aggregate({
      where: { showId: parsed.data.showId },
      _max: { position: true },
    });
    nextPos = (max._max.position ?? 0) + 1;
  } else {
    // 24/7 shop lot — must be buy_now or mystery, owned by current user.
    sellerId = session.user.id;
    const max = await prisma.lot.aggregate({
      where: { sellerId, showId: null },
      _max: { position: true },
    });
    nextPos = (max._max.position ?? 0) + 1;
  }

  const lot = await prisma.lot.create({
    data: {
      showId: parsed.data.showId ?? null,
      sellerId,
      position: nextPos,
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      startingBidCents: parsed.data.startingBidCents ?? 0,
      minIncrementCents: parsed.data.minIncrementCents ?? 100,
      softCloseSeconds: parsed.data.softCloseSeconds ?? 10,
      buyNowCents: parsed.data.buyNowCents ?? null,
      inventoryCount: parsed.data.inventoryCount ?? 1,
      mysteryContentsHtml:
        parsed.data.kind === "mystery"
          ? sanitizeMysteryHtml(parsed.data.mysteryContentsHtml ?? null) ||
            null
          : null,
      mysteryItemCount:
        parsed.data.kind === "mystery"
          ? parsed.data.mysteryItemCount ?? null
          : null,
    },
  });

  return NextResponse.json({ lot });
}
