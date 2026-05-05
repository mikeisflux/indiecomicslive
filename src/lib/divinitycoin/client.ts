import { getDivinityCoinConfig } from "./config";

// Outbound DC Partner API call. Pattern matches indiecrowdfund:
//   POST <baseUrl>?action=<action>
//   Authorization: Bearer <apiKey>
//   X-Partner-ID: <partnerId>
//   Content-Type: application/json
//   Body: <payload>
export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const cfg = await getDivinityCoinConfig();
  if (!cfg) return { ok: false, error: "DivinityCoin not configured", status: 0 };

  try {
    const r = await fetch(`${cfg.baseUrl}?action=${action}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "x-partner-id": cfg.partnerId,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        error:
          (typeof data.error === "string" ? data.error : null) ??
          `DC API ${action} failed (${r.status})`,
      };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
