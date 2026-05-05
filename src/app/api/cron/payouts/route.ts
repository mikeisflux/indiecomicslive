import { NextResponse } from "next/server";
import { processWeeklyPayouts } from "@/lib/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Weekly seller payout job. Runs every Thursday morning. Configured
// as a system cron on the app server:
//
//   0 13 * * 4   curl -fsS -X POST \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     https://indiecomicslive.com/api/cron/payouts >/var/log/icl-payouts.log 2>&1
//
// (13:00 UTC Thursday = 9:00 ET ≈ 8:00 ET during daylight saving.)
//
// The job is idempotent: re-running for the same Thursday only pays
// sellers that haven't already been processed for that week.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "cron_disabled", message: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await processWeeklyPayouts();
  console.log("[cron/payouts]", result);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return handle(req);
}

// GET supported so quick `curl` checks work without -X POST.
export async function GET(req: Request) {
  return handle(req);
}
