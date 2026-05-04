import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, shows } from "@/db";
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
    await db
      .update(shows)
      .set({ status: "live", startedAt: new Date() })
      .where(eq(shows.streamId, event.id));
  } else if (event.action === "liveStreamEnded") {
    await db
      .update(shows)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(shows.streamId, event.id));
  }

  return NextResponse.json({ ok: true });
}
