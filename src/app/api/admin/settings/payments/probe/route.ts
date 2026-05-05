import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/admin";
import { callDivinityCoinAPI } from "@/lib/divinitycoin";

// Probe endpoint: tries every plausible action-name convention so we
// can see which one DC's API actually understands. DC currently
// returns `{ error: 'Invalid action' }` for `create-setup-intent`
// (kebab-case) — this lets us discover whether they use snake_case,
// dot-notation, camelCase, etc., without bothering DC's support.
//
// Each candidate is sent with the SAME minimal payload. Results are
// returned as a list so the admin sees which (if any) made it past
// the action-validator.
//
// "Made it past validator" = response is NOT { error: 'Invalid action' }.
// A 4xx with a different error (e.g. "missing field") means we hit a
// real action and just need to fix the payload.

const CANDIDATES = [
  // Setup intent variants
  "create-setup-intent",
  "create_setup_intent",
  "createSetupIntent",
  "setup-intent.create",
  "setup_intent.create",
  "setup-intents.create",
  "setup_intents.create",
  "setupintent.create",
  // Payment intent
  "create-payment-intent",
  "create_payment_intent",
  "payment-intent.create",
  "payment_intent.create",
  // Card / generic
  "card.validate",
  "card.redeem",
  "ping",
  "test.ping",
  "test",
  "echo",
  // Listing / discovery
  "list-actions",
  "list_actions",
  "actions.list",
  "help",
  // Payout style
  "create-payout",
  "create_payout",
  "payout.create",
];

export async function GET() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  console.log("[dc-probe] starting", { candidates: CANDIDATES.length });

  const results = [];
  for (const action of CANDIDATES) {
    const r = await callDivinityCoinAPI(action, {
      platformUserId: me.id,
      purpose: "probe",
    });
    if (r.ok) {
      results.push({ action, status: 200, kind: "ok", error: null });
    } else {
      const isInvalidAction = /invalid action/i.test(r.error);
      results.push({
        action,
        status: r.status,
        kind: isInvalidAction ? "unknown_action" : "real_response",
        error: r.error.slice(0, 200),
      });
    }
  }

  // Sort: real responses (interesting!) first, then 200s, then unknowns.
  const score = (r: { kind: string }) =>
    r.kind === "real_response" ? 0 : r.kind === "ok" ? 1 : 2;
  results.sort((a, b) => score(a) - score(b));

  console.log("[dc-probe] done", {
    real: results.filter((r) => r.kind === "real_response").map((r) => r.action),
    ok: results.filter((r) => r.kind === "ok").map((r) => r.action),
  });

  return NextResponse.json({ results });
}
