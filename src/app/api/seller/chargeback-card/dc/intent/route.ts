import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST /api/seller/chargeback-card/dc/intent
//
// Asks DivinityCoin to mint a Stripe SetupIntent against their
// Connect account. The browser uses { clientSecret, publishableKey }
// it returns to render Stripe Elements; on confirmSetup success the
// resulting payment-method id comes back to /dc/confirm to persist
// in our SellerChargebackCard table.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await callDivinityCoinAPI("create-setup-intent", {
    platformUserId: session.user.id,
    purpose: "seller_chargeback_card",
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
  });
}
