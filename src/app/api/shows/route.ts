import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, shows } from "@/db";
import { auth } from "@/lib/auth";
import { buildPublishUrls, loadAntMediaConfig } from "@/lib/antmedia";

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

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  // Stream id = show id. Ant Media auto-creates the broadcast on first
  // publish; no REST call needed up front.
  const [row] = await db
    .insert(shows)
    .values({
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      scheduledFor: parsed.data.scheduledFor
        ? new Date(parsed.data.scheduledFor)
        : null,
    })
    .returning();

  await db
    .update(shows)
    .set({ streamId: row.id })
    .where(eq(shows.id, row.id));

  const publish = await buildPublishUrls(config, row.id);
  return NextResponse.json({ show: { ...row, streamId: row.id }, publish });
}
