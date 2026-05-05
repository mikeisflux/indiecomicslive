import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublishUrls, loadAntMediaConfig } from "@/lib/antmedia";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (show.sellerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  const streamId = show.streamId ?? show.id;
  if (!show.streamId) {
    await prisma.show.update({
      where: { id: show.id },
      data: { streamId },
    });
  }

  const publish = await buildPublishUrls(config, streamId);
  return NextResponse.json(publish);
}
