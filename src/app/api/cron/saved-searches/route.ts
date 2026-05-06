import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchLots } from "@/lib/search";
import { sendEmailRich } from "@/lib/email-rich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/saved-searches — daily run-through of every active
// SavedSearch. Authorize via `Authorization: Bearer $CRON_SECRET`.
//
// Wire as a system cron on the app server:
//   30 13 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://indiecomicslive.com/api/cron/saved-searches \
//     >>/var/log/icl-saved-searches.log 2>&1
//
// For each saved search:
//   - Find lots created since lastEmailedAt (or last 24h on first run).
//   - If any matches, send the buyer an email with the top results.
//   - Update lastEmailedAt regardless of whether matches were found,
//     so we don't re-scan the same window.
//
// Idempotent — re-running within the same day usually yields no new
// matches because lastEmailedAt has advanced.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://indiecomicslive.com";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const searches = await prisma.savedSearch.findMany({
    orderBy: { createdAt: "asc" },
    take: 5000, // sanity cap
    include: {
      user: { select: { id: true, email: true, name: true, emailUnsubscribedAt: true } },
    },
  });

  let scanned = 0;
  let emailed = 0;
  let totalMatches = 0;

  for (const s of searches) {
    scanned += 1;
    if (!s.user?.email) continue;
    if (s.user.emailUnsubscribedAt) continue;

    const since = s.lastEmailedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hits = await searchLots(s.query, {
      sinceCreatedAt: since,
      limit: 12,
    });

    if (hits.length > 0) {
      const subject = `${hits.length} new ${
        hits.length === 1 ? "match" : "matches"
      } for "${s.query}"`;
      const list = hits
        .map((h) => {
          const url = h.show
            ? `${SITE}/s/${h.show.id}`
            : h.seller.handle
              ? `${SITE}/shop/${h.seller.handle}`
              : SITE;
          const price =
            h.kind === "auction"
              ? `Auction · start ${dollars(h.startingBidCents)}`
              : dollars(h.buyNowCents ?? 0);
          return `<li style="margin:8px 0">
            <a href="${url}" style="color:#ff3366;text-decoration:none">${h.title}</a>
            <span style="color:#888"> — ${price}</span>
          </li>`;
        })
        .join("");
      const text = hits
        .map((h) => `- ${h.title} — ${SITE}/search?q=${encodeURIComponent(s.query)}`)
        .join("\n");
      const html = `
        <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:24px">
          <div style="max-width:560px;margin:0 auto">
            <h1 style="font-size:18px;margin:0 0 12px">New matches for "${s.query}"</h1>
            <ul style="padding-left:18px">${list}</ul>
            <p style="margin:24px 0 0;color:#888;font-size:12px">
              <a href="${SITE}/search?q=${encodeURIComponent(s.query)}" style="color:#aaa">All results</a> ·
              <a href="${SITE}/account/saved-searches" style="color:#aaa">Manage saved searches</a> ·
              <a href="${SITE}/account/notifications" style="color:#aaa">Unsubscribe</a>
            </p>
          </div>
        </body>`;
      const send = await sendEmailRich({
        to: [s.user.email],
        subject,
        text,
        html,
      });
      if (send.ok) emailed += 1;
      totalMatches += hits.length;
    }

    await prisma.savedSearch.update({
      where: { id: s.id },
      data: { lastEmailedAt: new Date() },
    });
  }

  console.log("[cron/saved-searches]", { scanned, emailed, totalMatches });
  return NextResponse.json({ ok: true, scanned, emailed, totalMatches });
}
