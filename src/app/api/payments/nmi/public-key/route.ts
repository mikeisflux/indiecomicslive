import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadNmiConfig } from "@/lib/nmi";

export const dynamic = "force-dynamic";

// CollectJS public tokenization key. Public by design, but gated to
// authenticated users to discourage random scraping.
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
