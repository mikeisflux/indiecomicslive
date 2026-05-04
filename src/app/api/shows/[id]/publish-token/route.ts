import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, shows } from "@/db";
import { buildPublishUrls, loadAntMediaConfig } from "@/lib/antmedia";

export const dynamic = "force-dynamic";

// Re-issue a publish token for a show. The seller dashboard calls this
// before going live so the token TTL is fresh.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [show] = await db.select().from(shows).where(eq(shows.id, id));
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
    await db.update(shows).set({ streamId }).where(eq(shows.id, show.id));
  }

  const publish = await buildPublishUrls(config, streamId);
  return NextResponse.json(publish);
}
