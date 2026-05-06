import { prisma } from "@/lib/prisma";

export type BidResult =
  | {
      ok: true;
      lotId: string;
      lotTitle: string;
      newCurrentBidCents: number;
      currentBidUserId: string;
      // The user who held the high bid before this one — null on the
      // opening bid. Used to fire an outbid push notification.
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

    const now = new Date();
    const softCloseMs = lot.soft_close_seconds * 1000;
    const remaining = lot.ends_at.getTime() - now.getTime();
    const newEndsAt =
      remaining < softCloseMs
        ? new Date(now.getTime() + softCloseMs)
        : lot.ends_at;

    await tx.bid.create({
      data: {
        lotId: opts.lotId,
        userId: opts.userId,
        amountCents: opts.amountCents,
        accepted: true,
      },
    });

    await tx.lot.update({
      where: { id: opts.lotId },
      data: {
        currentBidCents: opts.amountCents,
        currentBidUserId: opts.userId,
        endsAt: newEndsAt,
        bidCount: { increment: 1 },
      },
    });

    return {
      ok: true as const,
      lotId: opts.lotId,
      lotTitle: lot.title,
      newCurrentBidCents: opts.amountCents,
      currentBidUserId: opts.userId,
      previousHighBidderId: lot.current_bid_user_id,
      previousBidCents: lot.current_bid_cents,
      showId: lot.show_id,
      endsAt: newEndsAt,
      bidCount: lot.bid_count + 1,
    };
  });
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
