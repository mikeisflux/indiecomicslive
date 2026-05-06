import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/shows/[id]/leaderboard — top buyers for this show by total
// dollars spent (sum of paid orders on lots in this show). Public.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await prisma.$queryRaw<
    {
      buyer_id: string;
      handle: string | null;
      name: string | null;
      total_cents: number;
      wins: number;
    }[]
  >`
    SELECT o.buyer_id, u.handle, u.name,
           SUM(o.amount_cents)::int AS total_cents,
           COUNT(*)::int            AS wins
    FROM orders o
    JOIN lots l ON l.id = o.lot_id
    JOIN users u ON u.id = o.buyer_id
    WHERE l.show_id = ${id}::uuid
      AND o.status IN ('paid', 'shipped', 'delivered')
    GROUP BY o.buyer_id, u.handle, u.name
    ORDER BY total_cents DESC
    LIMIT 10
  `;
  return NextResponse.json({
    items: rows.map((r) => ({
      buyerId: r.buyer_id,
      label: r.name ?? (r.handle ? `@${r.handle}` : "buyer"),
      totalCents: Number(r.total_cents ?? 0),
      wins: Number(r.wins ?? 0),
    })),
  });
}
