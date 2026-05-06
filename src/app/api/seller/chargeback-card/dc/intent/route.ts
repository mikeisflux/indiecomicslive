import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST /api/seller/chargeback-card/dc/intent
//
// Mints a DC SetupIntent (Stripe Connect under the hood) for the
// seller's chargeback-recovery card. Browser uses { clientSecret,
// publishableKey } it returns to render Stripe Elements; on
// confirmCardSetup the resulting pm_... posts to /dc/confirm.
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
