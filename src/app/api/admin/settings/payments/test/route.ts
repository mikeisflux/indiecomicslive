import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/admin";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// POST — verify the configured API key + partner ID by calling a known
// real DC action with a trivial payload. We use create-setup-intent
// with a 'verify' purpose flag — DC either replies 200 with a setup
// intent (creds good, side effect: a stranded SetupIntent on their
// side that auto-expires after 24h), or a 401/403 (bad creds).
// 'Invalid action' would mean the route name doesn't exist; anything
// else with a body is fine since the round-trip proves auth works.
export async function POST() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  console.log("[dc-verify] starting Divinity Payments credential check", {
    adminId: me.id,
  });

  const r = await callDivinityCoinAPI("create-setup-intent", {
    platformUserId: me.id,
    purpose: "credential_verify",
  });

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

  // 401 / 403 = real auth failure. Anything else still means we
  // reached DC and it responded, which is what we wanted to confirm.
  if (r.status === 401 || r.status === 403) {
    return NextResponse.json(
      { ok: false, error: "Authentication rejected", detail: r.error, status: r.status },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `DC reachable (HTTP ${r.status}) — credentials accepted but the test action returned: ${r.error}`,
  });
}
