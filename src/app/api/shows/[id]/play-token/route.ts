import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPlayUrls, loadAntMediaConfig } from "@/lib/antmedia";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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

  const streamId = show.streamId ?? show.id;
  const play = await buildPlayUrls(config, streamId);
  return NextResponse.json(play);
}
