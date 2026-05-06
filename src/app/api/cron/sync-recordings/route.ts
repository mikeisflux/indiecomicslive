import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRecordingToR2 } from "@/lib/recording-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/sync-recordings — backstop for ShowRecording rows
// whose webhook-time R2 sync failed (network blip, AMS slow, etc).
// Authorize with `Authorization: Bearer $CRON_SECRET`.
//
// Recommended cron line on the app box:
//   */15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://indiecomicslive.com/api/cron/sync-recordings \
//     >>/var/log/icl-sync-recordings.log 2>&1
//
// Idempotent: rows with an r2Key already on the "recordings/" prefix
// are skipped by syncRecordingToR2 itself.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Pick AMS-pathed rows (i.e. NOT yet migrated). The startsWith filter
  // is cheap on Postgres LIKE.
  const rows = await prisma.showRecording.findMany({
    where: { NOT: { r2Key: { startsWith: "recordings/" } } },
    select: { id: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let failed = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const r of rows) {
    const result = await syncRecordingToR2(r.id);
    if (result.ok) migrated += 1;
    else {
      failed += 1;
      failures.push({ id: r.id, reason: result.reason ?? "unknown" });
    }
  }
  console.log("[cron/sync-recordings]", {
    scanned: rows.length,
    migrated,
    failed,
  });
  return NextResponse.json({ ok: true, scanned: rows.length, migrated, failed, failures });
}
