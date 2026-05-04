import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, orders } from "@/db";
import { eq } from "drizzle-orm";
import { chargeOrder } from "@/lib/payments";

// Manual charge endpoint. The auction-end flow tries to auto-charge;
// this is the retry button shown to a buyer when the auto-charge
// failed (declined card, network error, etc.).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await chargeOrder(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true, transactionId: result.transactionId });
}
