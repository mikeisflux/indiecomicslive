import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, shows } from "@/db";
import { buildPlayUrls, loadAntMediaConfig } from "@/lib/antmedia";

export const dynamic = "force-dynamic";

// Issue a short-lived play token. Anyone past the age gate can request
// one; tighten this if you add per-show paywalls or seller bans.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [show] = await db.select().from(shows).where(eq(shows.id, id));
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  const streamId = show.streamId ?? show.id;
  const play = await buildPlayUrls(config, streamId);
  return NextResponse.json(play);
}
