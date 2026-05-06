import { prisma } from "@/lib/prisma";

// Lot search. Postgres ILIKE on title/description with the query word
// list. Tiny — fits the MVP. If the catalog grows large enough that
// ILIKE on title/description is too slow, swap for tsvector + a GIN
// index. Keep the lib surface stable so the rest of the app doesn't
// have to change.
//
// Filters out lots that aren't currently buyable: must be in stock
// and either auction kind (regardless of show status) or buy_now /
// mystery (which are always sold from a 24/7 shop).

export interface SearchHit {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  kind: "auction" | "buy_now" | "mystery";
  buyNowCents: number | null;
  startingBidCents: number;
  shippingCostCents: number;
  inventoryCount: number;
  status: string;
  createdAt: Date;
  seller: { id: string; handle: string | null; name: string | null };
  show: { id: string } | null;
}

export async function searchLots(
  q: string,
  opts: { limit?: number; sinceCreatedAt?: Date } = {},
): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  // Tokenize on whitespace — every token must match (AND). Quoted
  // phrases handled later if we need them.
  const tokens = trimmed.split(/\s+/).slice(0, 8);
  const limit = opts.limit ?? 50;

  const rows = await prisma.lot.findMany({
    where: {
      AND: [
        { inventoryCount: { gt: 0 } },
        { status: { not: "unsold" } },
        ...(opts.sinceCreatedAt
          ? [{ createdAt: { gt: opts.sinceCreatedAt } }]
          : []),
        ...tokens.map((t) => ({
          OR: [
            { title: { contains: t, mode: "insensitive" as const } },
            { description: { contains: t, mode: "insensitive" as const } },
          ],
        })),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      seller: { select: { id: true, handle: true, name: true } },
      show: { select: { id: true } },
    },
  });

  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    imageUrl: l.imageUrl,
    kind: l.kind as unknown as "auction" | "buy_now" | "mystery",
    buyNowCents: l.buyNowCents,
    startingBidCents: l.startingBidCents,
    shippingCostCents: l.shippingCostCents,
    inventoryCount: l.inventoryCount,
    status: l.status as unknown as string,
    createdAt: l.createdAt,
    seller: l.seller ?? { id: "", handle: null, name: null },
    show: l.show,
  }));
}
