import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/admin";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST — call DC's `ping` action so admin can sanity-check API key +
// partner ID before flipping the active processor.
export async function POST() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const r = await callDivinityCoinAPI("ping", {});
  return NextResponse.json(r);
}
