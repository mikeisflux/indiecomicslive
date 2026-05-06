import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/admin";

export const runtime = "nodejs";

// Verify the configured Shippo credentials by calling /carrier_accounts.
// Live keys return a paginated list of every connected carrier; auth
// errors return 401/403. Anything else still confirms reachability +
// auth, surfaces the body.
export async function POST() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Read directly so the lib's 30s cache doesn't mask a fresh save.
  const { invalidateShippoCache } = await import("@/lib/shippo");
  invalidateShippoCache();
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.platformSetting.findUnique({
    where: { id: "default" },
    select: { shippoApiKey: true },
  });
  const key = row?.shippoApiKey ?? process.env.SHIPPO_API_KEY ?? "";
  if (!key) {
    return NextResponse.json({
      ok: false,
      error: "not_configured",
      message: "No Shippo API token saved.",
    });
  }

  let r: Response;
  try {
    r = await fetch("https://api.goshippo.com/carrier_accounts?results=200", {
      headers: { authorization: `ShippoToken ${key}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "network",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (r.status === 401 || r.status === 403) {
    return NextResponse.json({
      ok: false,
      status: r.status,
      error: "auth_failed",
      message: "Shippo rejected the token.",
    });
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      status: r.status,
      error: "shippo_error",
      message: body.slice(0, 300),
    });
  }
  const data = (await r.json().catch(() => ({}))) as {
    results?: { active?: boolean }[];
    count?: number;
  };
  const carriers = (data.results ?? []).filter((c) => c.active).length;
  return NextResponse.json({ ok: true, carriers });
}
