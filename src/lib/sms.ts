import { prisma } from "@/lib/prisma";
import { shouldNotify, type NotifKind } from "@/lib/notif-prefs";

// Outbound SMS dispatch. Currently a stub — wires the gating logic
// (per-kind opt-in, smsOptInAt, phone present) but no provider is
// configured. When TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
// TWILIO_FROM are set we POST to Twilio's REST API; otherwise the
// helper resolves a no-op and we log the intent.
//
// Keeping this thin so swapping vendors later is one fetch().

export async function smsToUser(
  userId: string,
  kind: NotifKind,
  body: string,
): Promise<{ ok: boolean; reason?: string }> {
  const wants = await shouldNotify(userId, kind, "sms").catch(() => false);
  if (!wants) return { ok: false, reason: "not_opted_in" };

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneE164: true },
  });
  if (!u?.phoneE164) return { ok: false, reason: "no_phone" };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log("[sms] not configured, skipping", {
      userId,
      kind,
      to: u.phoneE164,
    });
    return { ok: false, reason: "not_configured" };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({
      To: u.phoneE164,
      From: from,
      Body: body.slice(0, 320),
    });
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, reason: `twilio_${r.status}_${text.slice(0, 80)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "network_error",
    };
  }
}
