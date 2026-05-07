import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export const runtime = "nodejs";

// PATCH /api/account/notif-prefs — update per-kind notification
// preferences for the signed-in user. Body is the same JSON shape
// stored in User.notifPrefs (kind → { push, email, sms }). Missing
// keys default to opted-in, so a sparse object is fine.
const ChannelSchema = z
  .object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
  })
  .optional();

const Body = z.object({
  prefs: z
    .object({
      outbid: ChannelSchema,
      show_live: ChannelSchema,
      show_reminder: ChannelSchema,
      saved_search: ChannelSchema,
      giveaway_won: ChannelSchema,
      seller_broadcast: ChannelSchema,
      order_update: ChannelSchema,
      dispute_update: ChannelSchema,
    })
    .partial(),
  phoneE164: z.string().regex(/^\+\d{8,15}$/).optional().nullable(),
  smsOptIn: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const data: Record<string, unknown> = {
    notifPrefs: parsed.data.prefs as unknown as Prisma.InputJsonValue,
  };
  if (parsed.data.phoneE164 !== undefined) {
    data.phoneE164 = parsed.data.phoneE164;
  }
  if (parsed.data.smsOptIn !== undefined) {
    data.smsOptInAt = parsed.data.smsOptIn ? new Date() : null;
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });
  return NextResponse.json({ ok: true });
}
