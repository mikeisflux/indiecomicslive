// ShipStation V1 API client. We run a single master ShipStation
// account; sellers ship from their own addresses but everything bills
// to and tracks under our account. Auth is HTTP Basic with API key +
// secret (https://www.shipstation.com/docs/api/requirements/#authentication).
//
// Used by:
//   src/app/api/seller/orders/[id]/rates       — quote shipping rates
//   src/app/api/seller/orders/[id]/buy-label   — purchase + cache PDF
//   src/app/api/webhooks/shipstation           — receive delivery events

const BASE = "https://ssapi.shipstation.com";

function authHeader(): string | null {
  const key = process.env.SHIPSTATION_API_KEY;
  const secret = process.env.SHIPSTATION_API_SECRET;
  if (!key || !secret) return null;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

export interface ShipStationAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  residential?: boolean;
}

export interface ShipStationWeight {
  value: number;
  units: "ounces" | "pounds" | "grams" | "kilograms";
}

export interface ShipStationDimensions {
  length: number;
  width: number;
  height: number;
  units: "inches" | "centimeters";
}

export interface RateRequest {
  carrierCode: string;
  fromPostalCode: string;
  toState: string;
  toCountry: string;
  toPostalCode: string;
  toCity?: string;
  weight: ShipStationWeight;
  dimensions?: ShipStationDimensions;
  serviceCode?: string;
  packageCode?: string;
  confirmation?: "none" | "delivery" | "signature" | "adult_signature";
  residential?: boolean;
}

export interface Rate {
  serviceName: string;
  serviceCode: string;
  shipmentCost: number;
  otherCost: number;
}

export interface CreateLabelRequest {
  carrierCode: string;
  serviceCode: string;
  packageCode: string;
  confirmation?: "none" | "delivery" | "signature" | "adult_signature";
  shipDate: string; // YYYY-MM-DD
  weight: ShipStationWeight;
  dimensions?: ShipStationDimensions;
  shipFrom: ShipStationAddress;
  shipTo: ShipStationAddress;
  testLabel?: boolean;
}

export interface CreateLabelResponse {
  shipmentId: number;
  orderId?: number;
  trackingNumber: string;
  shipmentCost: number;
  insuranceCost: number;
  labelData: string; // base64 PDF
  labelFormat: "pdf" | "png" | string;
}

export interface Carrier {
  name: string;
  code: string;
  accountNumber?: string;
  requiresFundedAccount?: boolean;
  balance?: number;
}

export interface Service {
  carrierCode: string;
  code: string;
  name: string;
  domestic: boolean;
  international: boolean;
}

export interface Package {
  carrierCode: string;
  code: string;
  name: string;
  domestic: boolean;
  international: boolean;
}

async function ssFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "ShipStation not configured" };
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: auth,
      "content-type": "application/json",
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
      typeof parsed === "object" && parsed && "Message" in parsed
        ? String((parsed as Record<string, unknown>).Message)
        : typeof parsed === "string"
          ? parsed.slice(0, 400)
          : `ShipStation ${r.status}`;
    return { ok: false, status: r.status, error: msg };
  }
  return { ok: true, data: parsed as T };
}

export async function listCarriers() {
  return ssFetch<Carrier[]>("/carriers");
}

export async function listServices(carrierCode: string) {
  return ssFetch<Service[]>(`/carriers/listservices?carrierCode=${encodeURIComponent(carrierCode)}`);
}

export async function listPackages(carrierCode: string) {
  return ssFetch<Package[]>(`/carriers/listpackages?carrierCode=${encodeURIComponent(carrierCode)}`);
}

export async function getRates(req: RateRequest) {
  return ssFetch<Rate[]>("/shipments/getrates", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function createLabel(req: CreateLabelRequest) {
  return ssFetch<CreateLabelResponse>("/shipments/createlabel", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Buyer ship-to addresses are stored on the Order as a single
// free-text "shippingAddress" field. Try to recover the structured
// pieces ShipStation needs. Returns null if we can't get the bare
// minimum (street + city + state + postal).
//
// Expected freeform format (what our existing checkout writes):
//   Name
//   Street 1
//   Street 2 (optional)
//   City, ST 12345
//   Country (optional, default US)
//
// We accept reasonable variations.
export function parseShippingAddress(s: string | null): ShipStationAddress | null {
  if (!s) return null;
  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  // Find the city/state/zip line (US-format: "City, ST 12345" or
  // "City, ST 12345-6789"). Search bottom-up so a country line below
  // it doesn't trip us up.
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
    street3: streets.slice(2).join(" ") || undefined,
    city,
    state,
    postalCode,
    country: country.length === 2 ? country : "US",
    residential: true,
  };
}

// Convert our stored seller `shipFromAddress` JSON to ShipStation shape.
export function shipFromJsonToAddress(
  json: Record<string, unknown> | null | undefined,
): ShipStationAddress | null {
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
    postalCode,
    country: (get("country") ?? "US").slice(0, 2).toUpperCase(),
  };
}

// Best-effort: void / cancel a label. Useful if the buy-label flow
// succeeded at SS but our DB write failed and we want to claw it back.
export async function voidLabel(shipmentId: number | string) {
  return ssFetch<{ approved: boolean; message: string }>("/shipments/voidlabel", {
    method: "POST",
    body: JSON.stringify({ shipmentId: Number(shipmentId) }),
  });
}
