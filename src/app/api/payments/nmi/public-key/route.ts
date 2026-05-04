import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadNmiConfig } from "@/lib/nmi";

export const dynamic = "force-dynamic";

// Return the PaymentCloud (NMI) public tokenization key for CollectJS.
// Public by design — it ends up in the script tag's
// data-tokenization-key attribute. Gated to authenticated users only
// to cut down on key scraping by random crawlers.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = loadNmiConfig();
  if (!config?.publicKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }
  return NextResponse.json({ publicKey: config.publicKey });
}
