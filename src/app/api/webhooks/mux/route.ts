import { NextResponse } from "next/server";
import { db, shows } from "@/db";
import { eq } from "drizzle-orm";
import { verifyMuxWebhook } from "@/lib/mux";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("mux-signature");

  if (!verifyMuxWebhook(raw, sig)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    type: string;
    data: { id?: string; live_stream_id?: string };
  };

  if (event.type === "video.live_stream.active") {
    if (event.data.id) {
      await db
        .update(shows)
        .set({ status: "live", startedAt: new Date() })
        .where(eq(shows.muxLiveStreamId, event.data.id));
    }
  }

  if (event.type === "video.live_stream.idle") {
    if (event.data.id) {
      await db
        .update(shows)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(shows.muxLiveStreamId, event.data.id));
    }
  }

  return NextResponse.json({ ok: true });
}
