import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/admin";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST — verify the configured Divinity Payments API key + partner ID
// by calling DC's `health` GET action. health is a no-side-effect
// connectivity probe: it returns 200 if our auth is good, 401/403 if
// the partner credentials are wrong, anything else means DC is up but
// returned an unexpected shape.
//
// We picked health (GET) instead of create-setup-intent (which doesn't
// exist on DC) because:
//   - it has no side effects (won't litter DC's DB with stranded objects)
//   - it doesn't need any business-state arguments
//   - it's specifically intended for partner connectivity checks
export async function POST() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  console.log("[dc-verify] starting Divinity Payments credential check", {
    adminId: me.id,
  });

  const r = await callDivinityCoinAPI("health", {}, "GET");

  console.log("[dc-verify] result", {
    ok: r.ok,
    status: r.ok ? 200 : r.status,
    error: r.ok ? null : r.error,
  });

  if (r.ok) {
    return NextResponse.json({
      ok: true,
      message: "Credentials accepted by Divinity Payments.",
    });
  }

  if (r.status === 401 || r.status === 403) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication rejected",
        detail: r.error,
        status: r.status,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: false,
    error: `DC reachable (HTTP ${r.status}) but returned: ${r.error}`,
    status: r.status,
  });
}
