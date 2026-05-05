import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadAntMediaConfig, verifyAntMediaWebhook } from "@/lib/antmedia";
import { isIPBlocked, recordSuspiciousActivity } from "@/lib/bot-blocker";
import { getClientIP, getUserAgent } from "@/lib/client-ip";

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
    await prisma.show.updateMany({
      where: { streamId: event.id },
      data: { status: "live", startedAt: new Date() },
    });
  } else if (event.action === "liveStreamEnded") {
    await prisma.show.updateMany({
      where: { streamId: event.id },
      data: { status: "ended", endedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
