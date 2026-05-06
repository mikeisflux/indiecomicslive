// Shippo client. Single master Shippo account; sellers ship from
// their own addresses but everything bills + tracks under our account.
// Auth: Authorization: ShippoToken <SHIPPO_API_KEY> on every call.
//
// Used by:
//   src/app/api/seller/orders/[id]/rates       — quote shipping rates
//   src/app/api/seller/orders/[id]/buy-label   — purchase + cache PDF
//   src/app/api/seller/shipments/[id]/buy-label — bundle label
//   src/app/api/webhooks/shippo                — receive tracking events
//
// Two-step purchase model:
//   1. POST /shipments  → array of rates from every connected carrier
//   2. POST /transactions { rate: <object_id> } → tracking number + label PDF URL
//
// Shippo's rate amounts are strings ("5.95") in USD by default. We
// convert to integer cents at the call sites so everything inside
// our app stays in cents.

const BASE = "https://api.goshippo.com";

function authHeader(): string | null {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) return null;
  return `ShippoToken ${key}`;
}

export interface ShippoAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShippoParcel {
  // Shippo accepts strings or numbers; we always send strings to
  // dodge any local-vs-decimal issues.
  length: string;
  width: string;
  height: string;
  distance_unit: "in" | "cm";
  weight: string;
  mass_unit: "lb" | "oz" | "g" | "kg";
}

export interface ShippoRate {
  object_id: string;
  amount: string;            // "5.95"
  amount_local: string;
  currency: string;          // "USD"
  provider: string;          // "USPS", "UPS", ...
  provider_image_75?: string;
  servicelevel: {
    token: string;           // "usps_priority"
    name: string;            // "Priority Mail"
    terms?: string;
  };
  estimated_days?: number;
  duration_terms?: string;
}

export interface ShippoShipment {
  object_id: string;
  status: string;            // "SUCCESS" | "QUEUED" | "ERROR"
  rates: ShippoRate[];
  messages?: { text: string; code: string; source: string }[];
}

export interface ShippoTransaction {
  object_id: string;
  status: string;            // "SUCCESS" | "QUEUED" | "ERROR" | "REFUNDED"
  tracking_number: string | null;
  tracking_url_provider: string | null;
  label_url: string | null;
  rate: string;              // rate object_id
  messages?: { text: string; code: string; source: string }[];
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "Shippo not configured" };
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: auth,
      "content-type": "application/json",
      "shippo-api-version": "2018-02-08",
      ...(init?.headers ?? {}),
    },
  });
  const text = await r.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!r.ok) {
    const msg =
      typeof parsed === "object" && parsed && "detail" in parsed
        ? String((parsed as Record<string, unknown>).detail)
        : typeof parsed === "string"
          ? parsed.slice(0, 400)
          : `Shippo ${r.status}`;
    return { ok: false, status: r.status, error: msg };
  }
  return { ok: true, data: parsed as T };
}

// Create a Shipment object — synchronous so we get rates back in the
// same response. async:false caps at ~10s on Shippo's side; if we
// ever need international/oversized we may need async polling.
export async function createShipment(req: {
  address_from: ShippoAddress;
  address_to: ShippoAddress;
  parcels: ShippoParcel[];
  extra?: { signature_confirmation?: "STANDARD" | "ADULT" };
}) {
  const body: Record<string, unknown> = {
    address_from: req.address_from,
    address_to: req.address_to,
    parcels: req.parcels,
    async: false,
  };
  if (req.extra) body.extra = req.extra;
  return call<ShippoShipment>("/shipments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Buy a label for a previously-returned rate.
export async function createTransaction(rateId: string) {
  return call<ShippoTransaction>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      rate: rateId,
      label_file_type: "PDF",
      async: false,
    }),
  });
}

// Best-effort: refund / void a label that succeeded at Shippo but our
// downstream persistence failed. Shippo accepts the transaction id.
export async function refundTransaction(transactionId: string) {
  return call<{ object_id: string; status: string }>("/refunds", {
    method: "POST",
    body: JSON.stringify({ transaction: transactionId, async: false }),
  });
}

// Fetch tracking status for a known carrier + tracking number. Used
// by the periodic poll fallback when webhooks aren't reaching us.
export async function getTracking(carrier: string, trackingNumber: string) {
  return call<{
    tracking_number: string;
    tracking_status: { status: string; status_date: string };
    carrier: string;
  }>(
    `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`,
  );
}

// Convert our stored seller `shipFromAddress` JSON to Shippo's shape.
export function shipFromJsonToAddress(
  json: Record<string, unknown> | null | undefined,
): ShippoAddress | null {
  if (!json) return null;
  const get = (k: string): string | undefined => {
    const v = json[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const name = get("name");
  const street1 = get("street1");
  const city = get("city");
  const state = get("state");
  const postalCode = get("postalCode");
  if (!name || !street1 || !city || !state || !postalCode) return null;
  return {
    name,
    company: get("company"),
    phone: get("phone"),
    street1,
    street2: get("street2"),
    city,
    state: state.toUpperCase(),
    zip: postalCode,
    country: (get("country") ?? "US").slice(0, 2).toUpperCase(),
  };
}

// Buyer ship-to addresses are stored on the Order as a single
// free-text "shippingAddress" field (legacy from before we had a
// structured buyer-address model). Recover the structured pieces.
//
// Expected freeform format:
//   Name
//   Street 1
//   Street 2 (optional)
//   City, ST 12345
//   Country (optional, default US)
export function parseShippingAddress(s: string | null): ShippoAddress | null {
  if (!s) return null;
  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  let cszIdx = -1;
  let city = "";
  let state = "";
  let postalCode = "";
  for (let i = lines.length - 1; i >= 1; i--) {
    const m = lines[i].match(
      /^([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/,
    );
    if (m) {
      cszIdx = i;
      city = m[1].trim();
      state = m[2].toUpperCase();
      postalCode = m[3];
      break;
    }
  }
  if (cszIdx < 0) return null;

  const name = lines[0];
  const streets = lines.slice(1, cszIdx);
  if (streets.length === 0) return null;
  const country =
    cszIdx < lines.length - 1 ? lines[cszIdx + 1].slice(0, 2).toUpperCase() : "US";

  return {
    name,
    street1: streets[0],
    street2: streets[1],
    city,
    state,
    zip: postalCode,
    country: country.length === 2 ? country : "US",
  };
}
