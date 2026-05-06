import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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

  // Cap each seller at 10 outstanding scheduled-but-not-started shows
  // so they can't queue infinity placeholders.
  const MAX_SCHEDULED = 10;
  if (parsed.data.scheduledFor) {
    const scheduledAt = new Date(parsed.data.scheduledFor);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: "invalid_schedule", message: "Bad scheduled date." },
        { status: 400 },
      );
    }
    if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
      return NextResponse.json(
        { error: "schedule_in_past", message: "Scheduled time must be in the future." },
        { status: 400 },
      );
    }
    const scheduledCount = await prisma.show.count({
      where: {
        sellerId: session.user.id,
        status: "scheduled",
      },
    });
    if (scheduledCount >= MAX_SCHEDULED) {
      return NextResponse.json(
        {
          error: "too_many_scheduled",
          message: `You can have at most ${MAX_SCHEDULED} scheduled shows at a time. End or start an existing one first.`,
        },
        { status: 409 },
      );
    }
  }

  const config = loadAntMediaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "antmedia_not_configured" },
      { status: 502 },
    );
  }

  const created = await prisma.show.create({
    data: {
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      scheduledFor: parsed.data.scheduledFor
        ? new Date(parsed.data.scheduledFor)
        : null,
    },
  });

  // Stream id = show id. Ant Media auto-creates the broadcast on first
  // publish, so no REST call needed up front.
  const show = await prisma.show.update({
    where: { id: created.id },
    data: { streamId: created.id },
  });

  const publish = await buildPublishUrls(config, show.id);
  return NextResponse.json({ show, publish });
}
