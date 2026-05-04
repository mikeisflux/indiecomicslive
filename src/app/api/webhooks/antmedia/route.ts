import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadAntMediaConfig, verifyAntMediaWebhook } from "@/lib/antmedia";

// Ant Media stream webhook. Configure via "Stream Webhook" in the
// admin panel. Body shape (typical):
//   { id, action: "liveStreamStarted" | "liveStreamEnded" | ... }
export async function POST(req: Request) {
  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-ams-signature");
  if (!verifyAntMediaWebhook(raw, sig, config.webhookSecret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
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
