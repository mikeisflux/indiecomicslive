import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPlayUrls, loadAntMediaConfig } from "@/lib/antmedia";

export const dynamic = "force-dynamic";

// Returns playback URLs for the show's main stream by default. Pass
// ?cam=<streamId> to fetch playback for one of the show's registered
// extra cameras (multi-cam break setup).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const show = await prisma.show.findUnique({ where: { id } });
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

  const url = new URL(req.url);
  const camRaw = url.searchParams.get("cam");
  let streamId = show.streamId ?? show.id;
  if (camRaw) {
    const extras = (show.extraStreamIds ?? []) as Array<{
      id: string;
      label: string;
    }>;
    const match = extras.find((e) => e.id === camRaw);
    if (!match) {
      return NextResponse.json({ error: "cam_not_found" }, { status: 404 });
    }
    streamId = match.id;
  }

  const play = await buildPlayUrls(config, streamId);
  return NextResponse.json(play);
}
