import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadAntMediaConfig,
  setBroadcastRecording,
  verifyAntMediaWebhook,
} from "@/lib/antmedia";
import { isIPBlocked, recordSuspiciousActivity } from "@/lib/bot-blocker";
import { getClientIP, getUserAgent } from "@/lib/client-ip";
import { pushToUser } from "@/lib/push";
import { syncRecordingToR2 } from "@/lib/recording-sync";

// Ant Media stream webhook. Configure via "Stream Webhook" in the
// admin panel. Body shape (typical):
//   { id, action: "liveStreamStarted" | "liveStreamEnded" | ... }
//
// Auth: AMS versions vary. Some send X-AMS-Signature (HMAC of body
// using the configured webhook secret). Others have no separate
// secret field — for those, put the secret in the URL as a query
// param: https://your-host/api/webhooks/antmedia?token=<secret>
// We accept either method.
export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (await isIPBlocked(ip)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  const raw = await req.text();

  // Auth path A: ?token=<secret> in the URL
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get("token");
  const tokenOk =
    !!config.webhookSecret &&
    !!tokenParam &&
    timingSafeEqStr(tokenParam, config.webhookSecret);

  // Auth path B: X-AMS-Signature header (HMAC of body)
  const sig = req.headers.get("x-ams-signature");
  const sigOk = verifyAntMediaWebhook(raw, sig, config.webhookSecret);

  if (!tokenOk && !sigOk) {
    await recordSuspiciousActivity(ip, "antmedia_webhook_bad_auth", {
      path: "/api/webhooks/antmedia",
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ error: "bad_auth" }, { status: 401 });
  }

  const event = JSON.parse(raw) as { id?: string; action?: string };
  if (!event.id || !event.action) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  if (event.action === "liveStreamStarted") {
    const show = await prisma.show.findFirst({
      where: { streamId: event.id },
      select: {
        id: true,
        title: true,
        sellerId: true,
        recordingEnabled: true,
        seller: { select: { name: true, handle: true } },
      },
    });
    if (show) {
      await prisma.show.update({
        where: { id: show.id },
        data: { status: "live", startedAt: new Date() },
      });
      // Auto-toggle recording on the broadcast if the show wants it.
      if (show.recordingEnabled && event.id) {
        setBroadcastRecording(config, event.id, true).catch(() => {});
      }
      // Notify everyone who follows this seller, plus anyone who
      // explicitly watched this scheduled show.
      const [followers, watchers] = await Promise.all([
        prisma.follow.findMany({
          where: { sellerId: show.sellerId },
          select: { followerId: true },
        }),
        prisma.watchedShow.findMany({
          where: { showId: show.id },
          select: { userId: true },
        }),
      ]);
      const recipients = new Set<string>([
        ...followers.map((f) => f.followerId),
        ...watchers.map((w) => w.userId),
      ]);
      const sellerName =
        show.seller.name ?? `@${show.seller.handle ?? "indiecomicslive"}`;
      for (const userId of recipients) {
        pushToUser(userId, {
          kind: "show_live",
          title: `${sellerName} is live`,
          body: show.title,
          url: `/s/${show.id}`,
        }).catch(() => {});
      }
    }
  } else if (event.action === "liveStreamEnded") {
    await prisma.show.updateMany({
      where: { streamId: event.id },
      data: { status: "ended", endedAt: new Date() },
    });
  } else if (event.action === "vodReady" || event.action === "vod_ready") {
    // AMS finished muxing an MP4 for a stream we recorded. Persist a
    // ShowRecording row pointing at the AMS-served file path. A
    // background job (TODO) can later pull it to R2; for the MVP, the
    // replay player streams directly from AMS.
    const ev = event as unknown as {
      id?: string;
      vodName?: string;
      vodId?: string;
      filePath?: string;
      duration?: number;
      fileSize?: number;
    };
    const path = ev.filePath || ev.vodName;
    if (path && event.id) {
      const show = await prisma.show.findFirst({
        where: { streamId: event.id },
        select: { id: true },
      });
      if (show) {
        const rec = await prisma.showRecording.create({
          data: {
            showId: show.id,
            r2Key: path, // AMS-relative path; sync job rewrites to R2
            durationSec: ev.duration ? Math.round(ev.duration) : null,
            sizeBytes: ev.fileSize ?? null,
            startedAt: new Date(),
            endedAt: new Date(),
          },
          select: { id: true },
        });
        // Fire-and-forget the AMS → R2 migration so the webhook stays
        // fast. If it fails, the AMS path keeps working until the
        // sync cron picks it up.
        syncRecordingToR2(rec.id).catch((err) => {
          console.warn("[antmedia/webhook] sync failed", {
            recordingId: rec.id,
            err: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
