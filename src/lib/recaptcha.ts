// Google reCAPTCHA v2 ("I'm not a robot" checkbox).
//
// Config lives in PlatformSetting (id="default"). Surfaced on:
//   - /sign-in           via <RecaptchaWidget />
//   - /sign-up           via <RecaptchaWidget />
//   - /forgot-password   via <RecaptchaWidget />
//   - /seller/apply      via <RecaptchaWidget />
//   - any contact form   via <RecaptchaWidget />
//
// When `recaptchaEnabled` is false (or keys are missing) we skip
// verification — useful in dev, and lets the platform launch without
// a Google account. Each form should still render the widget when
// keys are present so admins can A/B without code changes.
//
// Verify endpoint: https://www.google.com/recaptcha/api/siteverify

import { prisma } from "@/lib/prisma";

export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string | null;
  // Server-only. Never returned to the client.
  secretKey: string | null;
}

let cached: { value: RecaptchaConfig; at: number } | null = null;
const CACHE_MS = 30 * 1000;

async function loadConfig(): Promise<RecaptchaConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const row = await prisma.platformSetting.findUnique({ where: { id: "default" } });
  const value: RecaptchaConfig = {
    enabled: !!row?.recaptchaEnabled && !!row?.recaptchaSiteKey && !!row?.recaptchaSecretKey,
    siteKey: row?.recaptchaSiteKey ?? null,
    secretKey: row?.recaptchaSecretKey ?? null,
  };
  cached = { value, at: Date.now() };
  return value;
}

export function invalidateRecaptchaCache(): void {
  cached = null;
}

// Server-only: get the site key for embedding into a form. The secret
// is intentionally not exposed.
export async function getRecaptchaSiteKey(): Promise<{ enabled: boolean; siteKey: string | null }> {
  const cfg = await loadConfig();
  return { enabled: cfg.enabled, siteKey: cfg.enabled ? cfg.siteKey : null };
}

// Server-only: get the full config for the admin settings page.
export async function getRecaptchaConfigAdmin(): Promise<RecaptchaConfig> {
  return loadConfig();
}

// Verify a token from the client. If reCAPTCHA isn't configured/
// enabled, returns ok:true so callers don't have to branch.
export async function verifyRecaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cfg = await loadConfig();
  if (!cfg.enabled || !cfg.secretKey) return { ok: true };

  if (!token) return { ok: false, reason: "missing_token" };

  const params = new URLSearchParams();
  params.set("secret", cfg.secretKey);
  params.set("response", token);
  if (remoteIp) params.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (e) {
    console.warn("[recaptcha] siteverify fetch failed", e);
    return { ok: false, reason: "verify_unreachable" };
  }

  if (!res.ok) return { ok: false, reason: `siteverify_${res.status}` };
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    "error-codes"?: string[];
  };
  if (data.success === true) return { ok: true };
  return {
    ok: false,
    reason: (data["error-codes"] ?? ["unknown"]).join(","),
  };
}
