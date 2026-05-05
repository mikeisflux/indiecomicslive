import { getDivinityCoinConfig } from "./config";

// Outbound DC Partner API call. Pattern matches indiecrowdfund:
//   POST <baseUrl>?action=<action>
//   Authorization: Bearer <apiKey>
//   X-Partner-ID: <partnerId>
//   Content-Type: application/json
//   Body: <payload>
//
// Logs every call with the action name, status, and (on error) the
// full DC response body so we can debug "Invalid action" / 4xx errors
// from pm2 logs without guessing.
//
// Valid POST actions (per DC partner docs):
//   validate, balance, hold, release, capture, record_capture,
//   create-payment-intent, refund, verify-payment
// Valid GET actions: health, settlements, settlement, captures
//
// DC does NOT have a setup-intent or "save card off-session" action.
// Anything in this codebase that calls create-setup-intent is dead
// code against DC — it'll always come back with "Invalid action".
export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const cfg = await getDivinityCoinConfig();
  if (!cfg) {
    console.warn("[dc] not configured", { action });
    return { ok: false, error: "DivinityCoin not configured", status: 0 };
  }

  const url = `${cfg.baseUrl}?action=${action}`;
  console.log("[dc] →", { method, action, url, partnerId: cfg.partnerId });

  try {
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "x-partner-id": cfg.partnerId,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
    };
    const r = await fetch(url, init);
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      // Non-JSON response (HTML error page, bare string). Log it.
      console.warn("[dc] ← non-JSON response", {
        action,
        status: r.status,
        body: text.slice(0, 800),
      });
      return {
        ok: false,
        status: r.status,
        error: text.slice(0, 400) || `DC ${action} returned ${r.status}`,
      };
    }
    if (!r.ok) {
      console.warn("[dc] ← error", {
        action,
        status: r.status,
        data,
      });
      return {
        ok: false,
        status: r.status,
        error:
          (typeof data.error === "string" ? data.error : null) ??
          (typeof data.message === "string" ? data.message : null) ??
          `DC API ${action} failed (${r.status})`,
      };
    }
    console.log("[dc] ← ok", { action, status: r.status, keys: Object.keys(data) });
    return { ok: true, data };
  } catch (e) {
    console.error("[dc] fetch threw", { action, error: e });
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
