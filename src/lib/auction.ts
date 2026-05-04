import { db, lots, bids, orders, shows } from "@/db";
import { and, eq, sql } from "drizzle-orm";

export type BidResult =
  | {
      ok: true;
      lotId: string;
      newCurrentBidCents: number;
      currentBidUserId: string;
      endsAt: Date;
      bidCount: number;
    }
  | { ok: false; reason: string };

export async function placeBid(opts: {
  lotId: string;
  userId: string;
  amountCents: number;
}): Promise<BidResult> {
  return await db.transaction(async (tx) => {
    const [lot] = await tx
      .select()
      .from(lots)
      .where(eq(lots.id, opts.lotId))
      .for("update");

    if (!lot) return { ok: false, reason: "lot_not_found" };
    if (lot.status !== "live") return { ok: false, reason: "lot_not_live" };
    if (!lot.endsAt || lot.endsAt.getTime() < Date.now()) {
      return { ok: false, reason: "lot_already_closed" };
    }

    const minNext =
      (lot.currentBidCents ?? lot.startingBidCents - lot.minIncrementCents) +
      lot.minIncrementCents;

    if (opts.amountCents < minNext) {
      await tx.insert(bids).values({
        lotId: opts.lotId,
        userId: opts.userId,
        amountCents: opts.amountCents,
        accepted: false,
        rejectReason: "below_min_increment",
      });
      return { ok: false, reason: "below_min_increment" };
    }

    if (lot.currentBidUserId === opts.userId) {
      return { ok: false, reason: "already_high_bidder" };
    }

    const now = new Date();
    const softCloseMs = lot.softCloseSeconds * 1000;
    const remaining = lot.endsAt.getTime() - now.getTime();
    const newEndsAt =
      remaining < softCloseMs
        ? new Date(now.getTime() + softCloseMs)
        : lot.endsAt;

    await tx.insert(bids).values({
      lotId: opts.lotId,
      userId: opts.userId,
      amountCents: opts.amountCents,
      accepted: true,
    });

    await tx
      .update(lots)
      .set({
        currentBidCents: opts.amountCents,
        currentBidUserId: opts.userId,
        endsAt: newEndsAt,
        bidCount: sql`${lots.bidCount} + 1`,
      })
      .where(eq(lots.id, opts.lotId));

    return {
      ok: true,
      lotId: opts.lotId,
      newCurrentBidCents: opts.amountCents,
      currentBidUserId: opts.userId,
      endsAt: newEndsAt,
      bidCount: lot.bidCount + 1,
    };
  });
}

export async function startNextLot(showId: string, durationSeconds = 30) {
  return await db.transaction(async (tx) => {
    await tx
      .update(lots)
      .set({ status: "live" })
      .where(
        and(
          eq(lots.showId, showId),
          eq(lots.status, "queued"),
          sql`${lots.position} = (
            SELECT MIN(position) FROM lots
            WHERE show_id = ${showId} AND status = 'queued'
          )`,
        ),
      );

    const [lot] = await tx
      .select()
      .from(lots)
      .where(and(eq(lots.showId, showId), eq(lots.status, "live")))
      .limit(1);

    if (!lot) return null;

    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);

    await tx
      .update(lots)
      .set({ startedAt: now, endsAt })
      .where(eq(lots.id, lot.id));

    return { ...lot, startedAt: now, endsAt };
  });
}

export async function closeLot(lotId: string) {
  return await db.transaction(async (tx) => {
    const [lot] = await tx
      .select()
      .from(lots)
      .where(eq(lots.id, lotId))
      .for("update");

    if (!lot || lot.status !== "live") return null;
    if (lot.endsAt && lot.endsAt.getTime() > Date.now()) return null;

    if (lot.currentBidUserId && lot.currentBidCents) {
      await tx
        .update(lots)
        .set({ status: "sold", soldAt: new Date() })
        .where(eq(lots.id, lotId));

      const [show] = await tx
        .select({ sellerId: shows.sellerId })
        .from(shows)
        .where(eq(shows.id, lot.showId));

      if (show) {
        await tx.insert(orders).values({
          lotId: lot.id,
          buyerId: lot.currentBidUserId,
          sellerId: show.sellerId,
          amountCents: lot.currentBidCents,
          status: "pending_payment",
        });
      }
      return { sold: true, lotId };
    }

    await tx
      .update(lots)
      .set({ status: "unsold" })
      .where(eq(lots.id, lotId));
    return { sold: false, lotId };
  });
}
