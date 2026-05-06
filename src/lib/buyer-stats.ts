import { prisma } from "@/lib/prisma";

// Aggregates for the buyer dashboard at /orders.
// All amounts are buyer-facing — gross of platform fees (the buyer
// sees / paid the gross). "savedVsWhatnot" is a marketing flourish
// computed against Whatnot's ~11% all-in vs our ~9%, applied to the
// same gross spend.

export interface BuyerStats {
  totalOrders: number;
  totalSpentCents: number;
  inFlightCount: number;       // paid + not delivered
  inFlightValueCents: number;  // sum of in-flight amounts
  deliveredCount: number;
  refundedCount: number;
  savedVsWhatnotCents: number; // estimate
}

export async function getBuyerStats(buyerId: string): Promise<BuyerStats> {
  // Pull all orders in one query — buyers don't have hundreds of
  // thousands of rows so this is fine.
  const orders = await prisma.order.findMany({
    where: {
      buyerId,
      status: { in: ["paid", "shipped", "delivered", "refunded"] },
    },
    select: {
      amountCents: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
    },
  });

  let totalSpentCents = 0;
  let inFlightCount = 0;
  let inFlightValueCents = 0;
  let deliveredCount = 0;
  let refundedCount = 0;

  for (const o of orders) {
    if (o.status === "refunded") {
      refundedCount++;
      continue;
    }
    totalSpentCents += o.amountCents;
    if (o.deliveredAt) {
      deliveredCount++;
    } else {
      inFlightCount++;
      inFlightValueCents += o.amountCents;
    }
  }

  // Whatnot ~11% all-in vs our ~9% all-in => buyer-attributable
  // savings is roughly 2% of gross. Crude but a useful comparator.
  const savedVsWhatnotCents = Math.round(totalSpentCents * 0.02);

  return {
    totalOrders: orders.filter((o) => o.status !== "refunded").length,
    totalSpentCents,
    inFlightCount,
    inFlightValueCents,
    deliveredCount,
    refundedCount,
    savedVsWhatnotCents,
  };
}

export interface FollowedLiveShow {
  id: string;
  title: string;
  coverImageUrl: string | null;
  status: string;
  scheduledFor: Date | null;
  seller: {
    id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
  };
}

// Live or scheduled shows from sellers the buyer follows. Used on
// the buyer dashboard to surface "Live now from your follows".
export async function getFollowedShowsForBuyer(
  buyerId: string,
  take = 8,
): Promise<FollowedLiveShow[]> {
  const follows = await prisma.follow.findMany({
    where: { followerId: buyerId },
    select: { sellerId: true },
  });
  if (follows.length === 0) return [];
  const sellerIds = follows.map((f) => f.sellerId);

  const shows = await prisma.show.findMany({
    where: {
      sellerId: { in: sellerIds },
      status: { in: ["live", "scheduled"] },
    },
    orderBy: [{ status: "desc" }, { scheduledFor: "asc" }],
    take,
    include: {
      seller: { select: { id: true, handle: true, name: true, image: true } },
    },
  });

  return shows.map((s) => ({
    id: s.id,
    title: s.title,
    coverImageUrl: s.coverImageUrl,
    status: s.status as unknown as string,
    scheduledFor: s.scheduledFor,
    seller: s.seller,
  }));
}

// Build a carrier tracking URL from { carrier, trackingNumber }.
// Returns null if we don't recognize the carrier.
export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  if (!carrier || !trackingNumber) return null;
  const c = carrier.toLowerCase();
  const t = encodeURIComponent(trackingNumber);
  if (c.includes("usps")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  }
  if (c.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${t}`;
  }
  if (c.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  }
  if (c.includes("dhl")) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${t}`;
  }
  return null;
}
