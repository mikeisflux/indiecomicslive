import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeTip } from "@/lib/tips";
import { broadcastToShow } from "@/lib/ws-broadcast";
import { pushToUser } from "@/lib/push";

export const runtime = "nodejs";

// POST /api/shows/[id]/tip — viewer tips the show host. Charges the
// buyer's default DC card via charge-saved-payment-method, then
// broadcasts a "tip" event to all connected viewers (host included)
// for confetti / leaderboard updates. Sends the host an in-app push.
const Body = z.object({
  amountCents: z.number().int().min(100).max(50_000),
  message: z.string().max(140).optional().nullable(),
  sticker: z.string().max(40).optional().nullable(),
});

const PRESETS = [100, 500, 1000, 2500, 5000];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Cap the choices: presets only OR any value within the min/max
  // range. Both keep the casual tip flow tight.
  if (
    !PRESETS.includes(parsed.data.amountCents) &&
    (parsed.data.amountCents < 100 || parsed.data.amountCents > 50_000)
  ) {
    return NextResponse.json(
      { error: "invalid_amount" },
      { status: 400 },
    );
  }

  const { id: showId } = await params;
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { id: true, sellerId: true, title: true },
  });
  if (!show) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (show.sellerId === session.user.id) {
    return NextResponse.json(
      { error: "self_tip", message: "You can't tip your own show." },
      { status: 400 },
    );
  }

  const tip = await prisma.showTip.create({
    data: {
      showId: show.id,
      fromUserId: session.user.id,
      toSellerId: show.sellerId,
      amountCents: parsed.data.amountCents,
      message: parsed.data.message ?? null,
      sticker: parsed.data.sticker ?? null,
    },
    select: { id: true },
  });

  const charge = await chargeTip(tip.id);
  if (!charge.ok) {
    return NextResponse.json(
      { error: "charge_failed", message: charge.reason, tipId: tip.id },
      { status: 402 },
    );
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, handle: true },
  });
  const fromLabel =
    fromUser?.name ?? (fromUser?.handle ? `@${fromUser.handle}` : "viewer");

  // Fan-out to viewers + the host's notification feed.
  broadcastToShow(show.id, {
    type: "tip",
    tipId: tip.id,
    amountCents: parsed.data.amountCents,
    fromLabel,
    message: parsed.data.message ?? null,
    sticker: parsed.data.sticker ?? null,
  }).catch(() => {});
  pushToUser(show.sellerId, {
    kind: "seller_broadcast",
    title: `${fromLabel} tipped $${(parsed.data.amountCents / 100).toFixed(2)}`,
    body: parsed.data.message ?? show.title,
    url: `/s/${show.id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, tipId: tip.id });
}

// GET /api/shows/[id]/tip — top tippers + recent tips (paid only).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const rows = await prisma.$queryRaw<
    {
      from_user_id: string;
      handle: string | null;
      name: string | null;
      total_cents: number;
      tip_count: number;
    }[]
  >`
    SELECT t.from_user_id, u.handle, u.name,
           SUM(t.amount_cents)::int AS total_cents,
           COUNT(*)::int           AS tip_count
    FROM show_tips t
    JOIN users u ON u.id = t.from_user_id
    WHERE t.show_id = ${showId}::uuid
      AND t.status = 'paid'
    GROUP BY t.from_user_id, u.handle, u.name
    ORDER BY total_cents DESC
    LIMIT 5
  `;
  return NextResponse.json({
    items: rows.map((r) => ({
      label: r.name ?? (r.handle ? `@${r.handle}` : "viewer"),
      totalCents: Number(r.total_cents ?? 0),
      tipCount: Number(r.tip_count ?? 0),
    })),
  });
}
