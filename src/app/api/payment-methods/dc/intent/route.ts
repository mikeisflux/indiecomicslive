import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await callDivinityCoinAPI("create-setup-intent", {
    platformUserId: session.user.id,
    purpose: "buyer_card_on_file",
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
