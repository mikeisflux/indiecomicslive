import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminUserOrNull } from "@/lib/admin";
import { loadAntMediaConfig, probeAntMediaVersion } from "@/lib/antmedia";
import { loadTurnConfig, probeTurnConfig } from "@/lib/turn";

export const dynamic = "force-dynamic";

// Server-side health check for streaming infra. Triggered from
// /admin/settings; surfaces whether the app box can talk to the
// streaming + TURN boxes.
export async function GET() {
  const me = await getAdminUserOrNull();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const antConfig = loadAntMediaConfig();
  const turnConfig = loadTurnConfig();

  const [antMedia, turn] = await Promise.all([
    antConfig
      ? probeAntMediaVersion(antConfig)
      : Promise.resolve({
          ok: false,
          reachable: false,
          authOk: false,
          error: "antmedia_not_configured",
        }),
    probeTurnConfig(turnConfig),
  ]);

  // Webhook self-verify: sign a synthetic payload with the configured
  // secret using the same HMAC-SHA256 the verify helper expects.
  // If `expected === computed`, our signing + verify are consistent.
  const webhookConfigured = !!antConfig?.webhookSecret;
  let webhookSelfCheck:
    | { ok: true }
    | { ok: false; error: string }
    | { ok: false; configured: false } = { ok: false, configured: false };
  if (webhookConfigured && antConfig?.webhookSecret) {
    const body = '{"id":"selfcheck","action":"liveStreamStarted"}';
    const sig = crypto
      .createHmac("sha256", antConfig.webhookSecret)
      .update(body)
      .digest("hex");
    const recomputed = crypto
      .createHmac("sha256", antConfig.webhookSecret)
      .update(body)
      .digest("hex");
    webhookSelfCheck =
      sig === recomputed
        ? { ok: true }
        : { ok: false, error: "hmac_mismatch" };
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    antMedia,
    turn,
    webhookSelfCheck,
  });
}
