import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST /api/payment-methods/dc/intent
//
// Asks DC for a Stripe SetupIntent so the buyer can add a card on
// file. Returns { clientSecret, publishableKey } for Stripe Elements.
// On confirmCardSetup success the browser POSTs the resulting
// payment_method.id to /dc/confirm to persist into UserPaymentMethod.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  const r = await callDivinityCoinAPI("create-setup-intent", {
    platformUserId: session.user.id,
    email: me?.email ?? "",
    name: me?.name ?? "",
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: "dc_intent_failed", detail: r.error },
      { status: 502 },
    );
  }
  return NextResponse.json({
    clientSecret: r.data.clientSecret,
    publishableKey: r.data.publishableKey,
    customerId: r.data.customerId,
  });
}
