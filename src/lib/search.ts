import { prisma } from "@/lib/prisma";

// Lot search. Postgres ILIKE on title/description with the query word
// list, plus optional category, price, and kind facets.

export interface SearchHit {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  kind: "auction" | "buy_now" | "mystery" | "pack_break" | "flash";
  buyNowCents: number | null;
  startingBidCents: number;
  shippingCostCents: number;
  inventoryCount: number;
  status: string;
  createdAt: Date;
  seller: { id: string; handle: string | null; name: string | null };
  show: { id: string } | null;
  category: { slug: string; name: string } | null;
}

export interface SearchOpts {
  limit?: number;
  sinceCreatedAt?: Date;
  categorySlug?: string | null;
  kind?: "auction" | "buy_now" | "mystery" | "pack_break" | "flash" | null;
  minCents?: number | null;
  maxCents?: number | null;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}

export async function searchLots(
  q: string,
  opts: SearchOpts = {},
): Promise<SearchHit[]> {
  const trimmed = q.trim();
  const tokens = trimmed ? trimmed.split(/\s+/).slice(0, 8) : [];
  const limit = opts.limit ?? 50;

  const where: Record<string, unknown> = {
    AND: [
      { inventoryCount: { gt: 0 } },
      { status: { not: "unsold" } },
      ...(opts.sinceCreatedAt
        ? [{ createdAt: { gt: opts.sinceCreatedAt } }]
        : []),
      ...(opts.kind ? [{ kind: opts.kind }] : []),
      ...(opts.categorySlug
        ? [{ category: { slug: opts.categorySlug } }]
        : []),
      ...(opts.minCents != null
        ? [
            {
              OR: [
                { buyNowCents: { gte: opts.minCents } },
                { startingBidCents: { gte: opts.minCents } },
              ],
            },
          ]
        : []),
      ...(opts.maxCents != null
        ? [
            {
              OR: [
                { buyNowCents: { lte: opts.maxCents } },
                { startingBidCents: { lte: opts.maxCents } },
              ],
            },
          ]
        : []),
      ...tokens.map((t) => ({
        OR: [
          { title: { contains: t, mode: "insensitive" as const } },
          { description: { contains: t, mode: "insensitive" as const } },
          { tags: { has: t.toLowerCase() } },
        ],
      })),
    ],
  };

  const orderBy =
    opts.sort === "price_asc"
      ? [{ buyNowCents: "asc" as const }, { startingBidCents: "asc" as const }]
      : opts.sort === "price_desc"
        ? [
            { buyNowCents: "desc" as const },
            { startingBidCents: "desc" as const },
          ]
        : opts.sort === "popular"
          ? [{ bidCount: "desc" as const }, { createdAt: "desc" as const }]
          : [{ createdAt: "desc" as const }];

  const rows = await prisma.lot.findMany({
    where: where as never,
    orderBy,
    take: limit,
    include: {
      seller: { select: { id: true, handle: true, name: true } },
      show: { select: { id: true } },
      category: { select: { slug: true, name: true } },
    },
  });

  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    imageUrl: l.imageUrl,
    kind: l.kind as unknown as "auction" | "buy_now" | "mystery" | "pack_break" | "flash",
    buyNowCents: l.buyNowCents,
    startingBidCents: l.startingBidCents,
    shippingCostCents: l.shippingCostCents,
    inventoryCount: l.inventoryCount,
    status: l.status as unknown as string,
    createdAt: l.createdAt,
    seller: l.seller ?? { id: "", handle: null, name: null },
    show: l.show,
    category: l.category,
  }));
}
