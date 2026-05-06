import { prisma } from "@/lib/prisma";

// Sales-tax helpers. Reads PlatformSetting.salesTaxRatesByState — a
// JSON map of 2-letter state codes to basis-points rates:
//   { "CA": 850, "NY": 800, "TX": 625 }
// States not in the map: no tax (no nexus).

let CACHE: { at: number; map: Record<string, number> } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadRates(): Promise<Record<string, number>> {
  if (CACHE && Date.now() - CACHE.at < CACHE_TTL_MS) return CACHE.map;
  const ps = await prisma.platformSetting.findUnique({
    where: { id: "default" },
    select: { salesTaxRatesByState: true },
  });
  const raw = (ps?.salesTaxRatesByState ?? {}) as unknown;
  const map: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && v >= 0 && v <= 2000) {
        map[String(k).toUpperCase()] = Math.round(v);
      }
    }
  }
  CACHE = { at: Date.now(), map };
  return map;
}

export function clearSalesTaxCache(): void {
  CACHE = null;
}

export async function computeSalesTaxCents(
  state: string | null | undefined,
  taxableCents: number,
): Promise<{ cents: number; jurisdiction: string | null; bps: number }> {
  if (!state || taxableCents <= 0) {
    return { cents: 0, jurisdiction: null, bps: 0 };
  }
  const rates = await loadRates();
  const bps = rates[state.toUpperCase()] ?? 0;
  if (!bps) return { cents: 0, jurisdiction: null, bps: 0 };
  const cents = Math.round((taxableCents * bps) / 10000);
  return { cents, jurisdiction: state.toUpperCase(), bps };
}
