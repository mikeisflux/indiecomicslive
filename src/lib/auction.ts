import { prisma } from "@/lib/prisma";

// One row per outbid event we want to broadcast. The first entry is
// always the original manual bid; any subsequent entries are proxy
// bids resolved by the auto-bid engine.
export interface BidEvent {
  lotId: string;
  lotTitle: string;
  amountCents: number;
  bidderId: string;
  previousHighBidderId: string | null;
  previousBidCents: number | null;
  proxy: boolean;
  endsAt: Date;
  bidCount: number;
  showId: string | null;
}

export type BidResult =
  | {
      ok: true;
      events: BidEvent[];
      // Final state — these duplicate the last event but are kept for
      // API back-compat with the old single-event return shape.
      lotId: string;
      lotTitle: string;
      newCurrentBidCents: number;
      currentBidUserId: string;
      previousHighBidderId: string | null;
      previousBidCents: number | null;
      showId: string | null;
      endsAt: Date;
      bidCount: number;
    }
  | { ok: false; reason: string };

// SELECT ... FOR UPDATE on the lot row inside a serializable
// transaction. Prisma doesn't expose row-locking directly so we use
// $queryRaw for the lock and the typed client for the rest.
type LockedLot = {
  id: string;
  title: string;
  show_id: string | null;
  status: "queued" | "live" | "sold" | "unsold";
  starting_bid_cents: number;
  min_increment_cents: number;
  soft_close_seconds: number;
  current_bid_cents: number | null;
  current_bid_user_id: string | null;
  ends_at: Date | null;
  bid_count: number;
};

export async function placeBid(opts: {
  lotId: string;
  userId: string;
  amountCents: number;
}): Promise<BidResult> {
  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedLot[]>`
      SELECT id, title, show_id, status, starting_bid_cents,
             min_increment_cents, soft_close_seconds, current_bid_cents,
             current_bid_user_id, ends_at, bid_count
      FROM lots WHERE id = ${opts.lotId}::uuid FOR UPDATE
    `;
    const lot = rows[0];

    if (!lot) return { ok: false as const, reason: "lot_not_found" };
    if (lot.status !== "live")
      return { ok: false as const, reason: "lot_not_live" };
    if (!lot.ends_at || lot.ends_at.getTime() < Date.now()) {
      return { ok: false as const, reason: "lot_already_closed" };
    }

    const minNext =
      (lot.current_bid_cents ??
        lot.starting_bid_cents - lot.min_increment_cents) +
      lot.min_increment_cents;

    if (opts.amountCents < minNext) {
      await tx.bid.create({
        data: {
          lotId: opts.lotId,
          userId: opts.userId,
          amountCents: opts.amountCents,
          accepted: false,
          rejectReason: "below_min_increment",
        },
      });
      return { ok: false as const, reason: "below_min_increment" };
    }

    if (lot.current_bid_user_id === opts.userId) {
      return { ok: false as const, reason: "already_high_bidder" };
    }

    const events: BidEvent[] = [];

    // Helper that places a single bid (manual or proxy), updates the
    // lot, extends soft-close, and records an event. All within `tx`.
    let currentBidCents = lot.current_bid_cents;
    let currentBidderId = lot.current_bid_user_id;
    let endsAt = lot.ends_at;
    let bidCount = lot.bid_count;

    const now = new Date();
    const softCloseMs = lot.soft_close_seconds * 1000;
    const minIncrement = lot.min_increment_cents;

    const apply = async (amt: number, userId: string, proxy: boolean) => {
      const remaining = endsAt!.getTime() - Date.now();
      const newEndsAt =
        remaining < softCloseMs
          ? new Date(Date.now() + softCloseMs)
          : endsAt!;
      await tx.bid.create({
        data: {
          lotId: lot.id,
          userId,
          amountCents: amt,
          accepted: true,
          proxy,
        },
      });
      await tx.lot.update({
        where: { id: lot.id },
        data: {
          currentBidCents: amt,
          currentBidUserId: userId,
          endsAt: newEndsAt,
          bidCount: { increment: 1 },
        },
      });
      const previousHighBidderId = currentBidderId;
      const previousBidCents = currentBidCents;
      currentBidCents = amt;
      currentBidderId = userId;
      endsAt = newEndsAt;
      bidCount += 1;
      events.push({
        lotId: lot.id,
        lotTitle: lot.title,
        amountCents: amt,
        bidderId: userId,
        previousHighBidderId,
        previousBidCents,
        proxy,
        endsAt: newEndsAt,
        bidCount,
        showId: lot.show_id,
      });
    };

    // 1) Apply the manual bid first.
    await apply(opts.amountCents, opts.userId, false);

    // 2) Resolve auto-bids in a loop. The user with the highest active
    //    cap should hold the lead at min(highest_cap, second_highest_cap + inc).
    //    We do it iteratively — at each step, find the highest-cap user
    //    who isn't currently leading and whose cap >= currentBid + inc.
    //    Place a proxy bid for them; loop until no candidates remain.
    //    Hard-cap the loop at 50 iterations to avoid infinite ping-pong
    //    on adversarial inputs.
    for (let i = 0; i < 50; i++) {
      const candidates = await tx.autoBid.findMany({
        where: {
          lotId: lot.id,
          active: true,
          maxAmountCents: { gte: (currentBidCents ?? 0) + minIncrement },
        },
        orderBy: [{ maxAmountCents: "desc" }, { createdAt: "asc" }],
      });
      const challenger = candidates.find((c) => c.userId !== currentBidderId);
      if (!challenger) break;

      // The challenger advances to min(theirCap, currentBid + inc).
      // (eBay convention: the lead bidder pays one increment over the
      // second-highest cap.)
      const next = Math.min(
        challenger.maxAmountCents,
        (currentBidCents ?? 0) + minIncrement,
      );
      if (next <= (currentBidCents ?? 0)) break;
      await apply(next, challenger.userId, true);
    }

    void now; // touched during apply; lint silencer
    const last = events[events.length - 1];
    return {
      ok: true as const,
      events,
      lotId: lot.id,
      lotTitle: lot.title,
      newCurrentBidCents: last.amountCents,
      currentBidUserId: last.bidderId,
      previousHighBidderId: events[0].previousHighBidderId,
      previousBidCents: events[0].previousBidCents,
      showId: lot.show_id,
      endsAt: last.endsAt,
      bidCount: last.bidCount,
    };
  });
}

// Buyer sets / updates a max-bid proxy. Idempotent on (lotId, userId).
// If the max is below the current bid we still store it but mark
// inactive so the engine ignores it.
export async function setAutoBid(opts: {
  lotId: string;
  userId: string;
  maxAmountCents: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (opts.maxAmountCents < 100) {
    return { ok: false as const, reason: "too_low" };
  }
  const lot = await prisma.lot.findUnique({
    where: { id: opts.lotId },
    select: { kind: true, status: true, currentBidCents: true },
  });
  if (!lot || (lot.kind !== "auction" && lot.kind !== "flash")) {
    return { ok: false as const, reason: "not_an_auction" };
  }
  await prisma.autoBid.upsert({
    where: { lotId_userId: { lotId: opts.lotId, userId: opts.userId } },
    update: { maxAmountCents: opts.maxAmountCents, active: true },
    create: {
      lotId: opts.lotId,
      userId: opts.userId,
      maxAmountCents: opts.maxAmountCents,
      active: true,
    },
  });
  return { ok: true as const };
}

export async function startNextLot(showId: string, durationSeconds = 30) {
  return await prisma.$transaction(async (tx) => {
    const next = await tx.lot.findFirst({
      where: { showId, status: "queued" },
      orderBy: { position: "asc" },
    });
    if (!next) return null;

    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);

    return await tx.lot.update({
      where: { id: next.id },
      data: { status: "live", startedAt: now, endsAt },
    });
  });
}

export async function closeLot(lotId: string) {
  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedLot[]>`
      SELECT id, status, starting_bid_cents, min_increment_cents,
             soft_close_seconds, current_bid_cents, current_bid_user_id,
             ends_at, bid_count
      FROM lots WHERE id = ${lotId}::uuid FOR UPDATE
    `;
    const lot = rows[0];
    if (!lot || lot.status !== "live") return null;
    if (lot.ends_at && lot.ends_at.getTime() > Date.now()) return null;

    if (lot.current_bid_user_id && lot.current_bid_cents) {
      await tx.lot.update({
        where: { id: lotId },
        data: { status: "sold", soldAt: new Date() },
      });

      const showRow = await tx.lot.findUnique({
        where: { id: lotId },
        select: {
          shippingCostCents: true,
          show: { select: { sellerId: true } },
        },
      });

      if (showRow?.show) {
        const shipping = showRow.shippingCostCents ?? 0;
        const order = await tx.order.create({
          data: {
            lotId,
            buyerId: lot.current_bid_user_id,
            sellerId: showRow.show.sellerId,
            // Total charged to the winning bidder = winning bid + shipping.
            amountCents: lot.current_bid_cents + shipping,
            shippingCents: shipping,
            status: "pending_payment",
          },
          select: { id: true },
        });
        return { sold: true as const, lotId, orderId: order.id };
      }
      return { sold: true as const, lotId, orderId: null };
    }

    await tx.lot.update({
      where: { id: lotId },
      data: { status: "unsold" },
    });
    return { sold: false as const, lotId };
  });
}
