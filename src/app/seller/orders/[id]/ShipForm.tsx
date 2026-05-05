"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rate {
  serviceCode: string;
  serviceName: string;
  shipmentCost: number;
  otherCost: number;
}

const CARRIERS = [
  { code: "stamps_com", label: "USPS (Stamps.com)" },
  { code: "ups", label: "UPS" },
  { code: "fedex", label: "FedEx" },
  { code: "dhl_express", label: "DHL Express" },
];

const PACKAGES = [
  { code: "package", label: "Package (your own box)" },
  { code: "flat_rate_envelope", label: "Flat Rate Envelope" },
  { code: "flat_rate_padded_envelope", label: "Flat Rate Padded Envelope" },
  { code: "small_flat_rate_box", label: "Small Flat Rate Box" },
  { code: "medium_flat_rate_box", label: "Medium Flat Rate Box" },
  { code: "large_flat_rate_box", label: "Large Flat Rate Box" },
];

export default function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrierCode, setCarrierCode] = useState("stamps_com");
  const [packageCode, setPackageCode] = useState("package");
  const [weightLb, setWeightLb] = useState("0");
  const [weightOz, setWeightOz] = useState("8");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [confirmation, setConfirmation] = useState("delivery");
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [serviceCode, setServiceCode] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function totalOunces(): number {
    const lb = parseFloat(weightLb || "0") || 0;
    const oz = parseFloat(weightOz || "0") || 0;
    return lb * 16 + oz;
  }

  function dimensionsBody() {
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if ([l, w, h].every((n) => Number.isFinite(n) && n > 0)) {
      return { length: l, width: w, height: h, units: "inches" as const };
    }
    return undefined;
  }

  async function quote() {
    setBusy(true);
    setError(null);
    setRates(null);
    setServiceCode("");
    const r = await fetch(`/api/seller/orders/${orderId}/rates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        carrierCode,
        packageCode,
        weight: { value: totalOunces(), units: "ounces" },
        dimensions: dimensionsBody(),
        confirmation,
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || data.error || "Failed to fetch rates");
      return;
    }
    setRates(data.rates as Rate[]);
    if (Array.isArray(data.rates) && data.rates.length > 0) {
      setServiceCode(data.rates[0].serviceCode);
    }
  }

  async function buy() {
    if (!serviceCode) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/seller/orders/${orderId}/buy-label`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        carrierCode,
        serviceCode,
        packageCode,
        weight: { value: totalOunces(), units: "ounces" },
        dimensions: dimensionsBody(),
        confirmation,
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || data.error || "Failed to buy label");
      return;
    }
    router.refresh();
    if (data.labelUrl) {
      window.open(data.labelUrl, "_blank");
    }
  }

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs text-paper/60";

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Carrier</label>
          <select className={inp} value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)}>
            {CARRIERS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Package</label>
          <select className={inp} value={packageCode} onChange={(e) => setPackageCode(e.target.value)}>
            {PACKAGES.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Weight (lb)</label>
          <input className={inp} inputMode="decimal" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Weight (oz)</label>
          <input className={inp} inputMode="decimal" value={weightOz} onChange={(e) => setWeightOz(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Confirmation</label>
          <select className={inp} value={confirmation} onChange={(e) => setConfirmation(e.target.value)}>
            <option value="none">None</option>
            <option value="delivery">Delivery</option>
            <option value="signature">Signature</option>
            <option value="adult_signature">Adult signature</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Length (in)</label>
          <input className={inp} inputMode="decimal" placeholder="optional" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Width (in)</label>
          <input className={inp} inputMode="decimal" placeholder="optional" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Height (in)</label>
          <input className={inp} inputMode="decimal" placeholder="optional" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
      </div>

      <button
        type="button"
        onClick={quote}
        disabled={busy || totalOunces() <= 0}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {busy && !rates ? "Quoting…" : "Get rates"}
      </button>

      {rates && rates.length === 0 && (
        <p className="text-sm text-paper/60">
          No rates returned for that carrier + package combination.
        </p>
      )}

      {rates && rates.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-paper/50">
            Pick a service
          </p>
          <ul className="space-y-1 text-sm">
            {rates.map((r) => {
              const total = (r.shipmentCost ?? 0) + (r.otherCost ?? 0);
              return (
                <li key={r.serviceCode}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/5">
                    <input
                      type="radio"
                      name="serviceCode"
                      value={r.serviceCode}
                      checked={serviceCode === r.serviceCode}
                      onChange={() => setServiceCode(r.serviceCode)}
                    />
                    <span className="flex-1">{r.serviceName}</span>
                    <span className="font-mono text-paper/80">${total.toFixed(2)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={buy}
            disabled={busy || !serviceCode}
            className="mt-3 rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
          >
            {busy ? "Buying…" : "Buy label"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
