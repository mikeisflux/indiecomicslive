import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

// Lot search. When q is provided, we try Postgres tsvector full-text
// (after the maintenance endpoint installs the column + GIN index)
// and fall back to the original ILIKE-AND path if the index is
// missing / the raw query errors. Facets (category / kind / price)
// apply in both paths.

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
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "hot";
}

export async function searchLots(
  q: string,
  opts: SearchOpts = {},
): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (trimmed) {
    try {
      return await searchViaFullText(trimmed, opts);
    } catch {
      // Fall through to ILIKE — happens before the search-index
      // maintenance route has been called, or when the column was
      // dropped manually.
    }
  }
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

  // "hot" silently widens to the last 7 days so the sort actually
  // surfaces what's *currently* hot rather than a 6-month-old lot
  // with ten bids. The orderBy then still uses bidCount + recency.
  if (opts.sort === "hot") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    (where.AND as unknown[]).push({ createdAt: { gte: sevenDaysAgo } });
  }

  const orderBy =
    opts.sort === "price_asc"
      ? [{ buyNowCents: "asc" as const }, { startingBidCents: "asc" as const }]
      : opts.sort === "price_desc"
        ? [
            { buyNowCents: "desc" as const },
            { startingBidCents: "desc" as const },
          ]
        : opts.sort === "popular" || opts.sort === "hot"
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

interface RawHit {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  kind: string;
  buy_now_cents: number | null;
  starting_bid_cents: number;
  shipping_cost_cents: number;
  inventory_count: number;
  status: string;
  created_at: Date;
  seller_id: string | null;
  seller_handle: string | null;
  seller_name: string | null;
  show_id: string | null;
  category_slug: string | null;
  category_name: string | null;
}

async function searchViaFullText(
  q: string,
  opts: SearchOpts,
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 50;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filters: Prisma.Sql[] = [
    Prisma.sql`l.search_vector @@ plainto_tsquery('english', ${q})`,
    Prisma.sql`l.inventory_count > 0`,
    Prisma.sql`l.status::text != 'unsold'`,
  ];
  if (opts.kind) {
    filters.push(Prisma.sql`l.kind::text = ${opts.kind}`);
  }
  if (opts.categorySlug) {
    filters.push(Prisma.sql`c.slug = ${opts.categorySlug}`);
  }
  if (opts.minCents != null) {
    filters.push(
      Prisma.sql`COALESCE(l.buy_now_cents, l.starting_bid_cents) >= ${opts.minCents}`,
    );
  }
  if (opts.maxCents != null) {
    filters.push(
      Prisma.sql`COALESCE(l.buy_now_cents, l.starting_bid_cents) <= ${opts.maxCents}`,
    );
  }
  if (opts.sinceCreatedAt) {
    filters.push(Prisma.sql`l.created_at > ${opts.sinceCreatedAt}`);
  }
  if (opts.sort === "hot") {
    filters.push(Prisma.sql`l.created_at >= ${sevenDaysAgo}`);
  }

  const orderBy =
    opts.sort === "price_asc"
      ? Prisma.sql`COALESCE(l.buy_now_cents, l.starting_bid_cents) ASC, l.created_at DESC`
      : opts.sort === "price_desc"
        ? Prisma.sql`COALESCE(l.buy_now_cents, l.starting_bid_cents) DESC, l.created_at DESC`
        : opts.sort === "popular" || opts.sort === "hot"
          ? Prisma.sql`l.bid_count DESC, l.created_at DESC`
          : opts.sort === "newest"
            ? Prisma.sql`l.created_at DESC`
            : Prisma.sql`ts_rank(l.search_vector, plainto_tsquery('english', ${q})) DESC, l.created_at DESC`;

  const rows = await prisma.$queryRaw<RawHit[]>`
    SELECT l.id,
           l.title,
           l.description,
           l.image_url,
           l.kind::text                      AS kind,
           l.buy_now_cents,
           l.starting_bid_cents,
           l.shipping_cost_cents,
           l.inventory_count,
           l.status::text                    AS status,
           l.created_at,
           u.id      AS seller_id,
           u.handle  AS seller_handle,
           u.name    AS seller_name,
           l.show_id,
           c.slug    AS category_slug,
           c.name    AS category_name
      FROM lots l
      LEFT JOIN users u      ON u.id = l.seller_id
      LEFT JOIN categories c ON c.id = l.category_id
     WHERE ${Prisma.join(filters, " AND ")}
     ORDER BY ${orderBy}
     LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    kind: r.kind as
      | "auction"
      | "buy_now"
      | "mystery"
      | "pack_break"
      | "flash",
    buyNowCents: r.buy_now_cents,
    startingBidCents: r.starting_bid_cents,
    shippingCostCents: r.shipping_cost_cents,
    inventoryCount: r.inventory_count,
    status: r.status,
    createdAt: r.created_at,
    seller: {
      id: r.seller_id ?? "",
      handle: r.seller_handle,
      name: r.seller_name,
    },
    show: r.show_id ? { id: r.show_id } : null,
    category:
      r.category_slug && r.category_name
        ? { slug: r.category_slug, name: r.category_name }
        : null,
  }));
}
