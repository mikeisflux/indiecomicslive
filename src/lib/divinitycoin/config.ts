import { prisma } from "@/lib/prisma";
import type { DivinityCoinConfig } from "./types";

const DEFAULT_BASE_URL = "https://divinitycoin.com/internal";

// Reads the singleton PlatformSetting row. Falls back to env vars so
// the very first deploy on a fresh DB still works before an admin has
// saved settings in /admin/settings/payments.
export async function getDivinityCoinConfig(): Promise<DivinityCoinConfig | null> {
  const settings = await prisma.platformSetting
    .findUnique({ where: { id: "default" } })
    .catch(() => null);

  if (settings?.divinityCoinEnabled && settings.divinityCoinApiKey) {
    return {
      apiKey: settings.divinityCoinApiKey,
      publicKey: settings.divinityCoinPublicKey ?? null,
      privateKey: settings.divinityCoinPrivateKey ?? null,
      partnerId: settings.divinityCoinPartnerId ?? "",
      webhookSecret: settings.divinityCoinWebhookSecret ?? "",
      baseUrl:
        settings.divinityCoinBaseUrl ??
        process.env.DIVINITYCOIN_API_URL ??
        DEFAULT_BASE_URL,
    };
  }

  if (process.env.DIVINITYCOIN_API_KEY) {
    return {
      apiKey: process.env.DIVINITYCOIN_API_KEY,
      publicKey: process.env.DIVINITYCOIN_PUBLIC_KEY ?? null,
      privateKey: process.env.DIVINITYCOIN_PRIVATE_KEY ?? null,
      partnerId: process.env.DIVINITYCOIN_PARTNER_ID ?? "",
      webhookSecret: process.env.DIVINITYCOIN_WEBHOOK_SECRET ?? "",
      baseUrl: process.env.DIVINITYCOIN_API_URL ?? DEFAULT_BASE_URL,
    };
  }

  return null;
}

export async function getDivinityCoinWebhookSecret(): Promise<string | null> {
  const cfg = await getDivinityCoinConfig();
  return cfg?.webhookSecret ?? null;
}

// Which processor the platform is currently routing buyer charges
// through. Defaults to "nmi" for backwards-compat with merchants who
// haven't migrated yet.
export async function getActiveProcessor(): Promise<"nmi" | "divinitycoin"> {
  const settings = await prisma.platformSetting
    .findUnique({ where: { id: "default" }, select: { activeProcessor: true } })
    .catch(() => null);
  return (settings?.activeProcessor as "nmi" | "divinitycoin") ?? "nmi";
}
