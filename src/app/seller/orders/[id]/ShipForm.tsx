"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rate {
  rateId: string;
  provider: string;
  serviceName: string;
  serviceToken: string;
  amountCents: number;
  currency: string;
  estimatedDays: number | null;
}

// Two-step flow against /api/seller/orders/[id]/rates and /buy-label
// (Shippo under the hood). Seller fills weight + dimensions, hits
// "Get rates" to see every connected carrier's options, picks one,
// then "Buy label" finalizes the purchase.
export default function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [weightLb, setWeightLb] = useState("0");
  const [weightOz, setWeightOz] = useState("8");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [signature, setSignature] = useState<"none" | "standard" | "adult">(
    "none",
  );
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [rateId, setRateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert pounds + ounces → total ounces, then to a single
  // decimal-pound value Shippo prefers.
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
      return { length: l, width: w, height: h, units: "in" as const };
    }
    return undefined;
  }

  async function quote() {
    setBusy(true);
    setError(null);
    setRates(null);
    setRateId("");
    const r = await fetch(`/api/seller/orders/${orderId}/rates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        weight: { value: totalOunces(), units: "oz" },
        dimensions: dimensionsBody(),
        signatureConfirmation: signature,
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
      setRateId(data.rates[0].rateId);
    }
  }

  async function buy() {
    if (!rateId || !rates) return;
    const chosen = rates.find((r) => r.rateId === rateId);
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/seller/orders/${orderId}/buy-label`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rateId: chosen.rateId,
        provider: chosen.provider,
        serviceName: chosen.serviceName,
        amountCents: chosen.amountCents,
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || data.error || "Failed to buy label");
      return;
    }
    router.refresh();
    if (data.labelUrl) window.open(data.labelUrl, "_blank");
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs text-paper/60";

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Weight (lb)</label>
          <input
            className={inp}
            inputMode="decimal"
            value={weightLb}
            onChange={(e) => setWeightLb(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Weight (oz)</label>
          <input
            className={inp}
            inputMode="decimal"
            value={weightOz}
            onChange={(e) => setWeightOz(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Signature</label>
          <select
            className={inp}
            value={signature}
            onChange={(e) =>
              setSignature(e.target.value as "none" | "standard" | "adult")
            }
          >
            <option value="none">None</option>
            <option value="standard">Standard</option>
            <option value="adult">Adult</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Length (in)</label>
          <input
            className={inp}
            inputMode="decimal"
            placeholder="optional"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Width (in)</label>
          <input
            className={inp}
            inputMode="decimal"
            placeholder="optional"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Height (in)</label>
          <input
            className={inp}
            inputMode="decimal"
            placeholder="optional"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
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
          No rates returned. Connect a carrier in your Shippo dashboard or
          adjust weight / dimensions.
        </p>
      )}

      {rates && rates.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-paper/50">
            Pick a service
          </p>
          <ul className="space-y-1 text-sm">
            {rates.map((r) => (
              <li key={r.rateId}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/5">
                  <input
                    type="radio"
                    name="rateId"
                    value={r.rateId}
                    checked={rateId === r.rateId}
                    onChange={() => setRateId(r.rateId)}
                  />
                  <span className="flex-1">
                    <span className="font-semibold">{r.provider}</span>{" "}
                    <span className="text-paper/70">{r.serviceName}</span>
                    {r.estimatedDays !== null && (
                      <span className="ml-2 text-xs text-paper/50">
                        ~{r.estimatedDays}d
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-paper/80">
                    ${(r.amountCents / 100).toFixed(2)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={buy}
            disabled={busy || !rateId}
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
