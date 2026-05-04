import { NextResponse } from "next/server";
import { z } from "zod";
import { db, shows } from "@/db";
import { auth } from "@/lib/auth";
import { createLiveStream } from "@/lib/mux";

const Body = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const stream = await createLiveStream();

  const [row] = await db
    .insert(shows)
    .values({
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      scheduledFor: parsed.data.scheduledFor
        ? new Date(parsed.data.scheduledFor)
        : null,
      muxLiveStreamId: stream.liveStreamId,
      muxStreamKey: stream.streamKey,
      muxPlaybackId: stream.playbackId,
    })
    .returning();

  return NextResponse.json({
    show: row,
    rtmp: { url: stream.rtmpUrl, streamKey: stream.streamKey },
  });
}
