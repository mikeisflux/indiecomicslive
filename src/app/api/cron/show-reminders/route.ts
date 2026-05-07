import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/show-reminders — runs every minute. For each
// scheduled show whose start time is between 5 and 20 minutes from
// now (and whose reminderSentAt is still null), push every follower
// + watcher a "going live soon" notification. Sets reminderSentAt
// to mark idempotency.
//
// Cron line on the app box (every minute is overkill for production
// but cheap):
//   * * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://indiecomicslive.com/api/cron/show-reminders \
//     >>/var/log/icl-show-reminders.log 2>&1
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const min = new Date(now.getTime() + 5 * 60 * 1000);
  const max = new Date(now.getTime() + 20 * 60 * 1000);

  const shows = await prisma.show.findMany({
    where: {
      status: "scheduled",
      reminderSentAt: null,
      scheduledFor: { gte: min, lte: max },
    },
    select: {
      id: true,
      title: true,
      sellerId: true,
      scheduledFor: true,
      seller: { select: { name: true, handle: true } },
    },
    take: 50,
  });

  let notified = 0;
  for (const s of shows) {
    const [followers, watchers] = await Promise.all([
      prisma.follow.findMany({
        where: { sellerId: s.sellerId },
        select: { followerId: true },
      }),
      prisma.watchedShow.findMany({
        where: { showId: s.id },
        select: { userId: true },
      }),
    ]);
    const recipients = new Set<string>([
      ...followers.map((f) => f.followerId),
      ...watchers.map((w) => w.userId),
    ]);
    const sellerLabel =
      s.seller.name ?? `@${s.seller.handle ?? "indiecomicslive"}`;
    const minsUntil = Math.max(
      1,
      Math.round((s.scheduledFor!.getTime() - now.getTime()) / 60_000),
    );
    for (const userId of recipients) {
      pushToUser(userId, {
        kind: "show_reminder",
        title: `${sellerLabel} goes live in ~${minsUntil} min`,
        body: s.title,
        url: `/s/${s.id}`,
      }).catch(() => {});
      notified += 1;
    }
    await prisma.show.update({
      where: { id: s.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({
    ok: true,
    scanned: shows.length,
    notified,
  });
}
