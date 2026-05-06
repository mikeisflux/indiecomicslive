"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormType = "W9" | "W8";

export default function TaxForm({
  defaultType,
  defaultAddress,
}: {
  defaultType: FormType;
  defaultAddress: Record<string, string> | null;
}) {
  const router = useRouter();
  const [formType, setFormType] = useState<FormType>(defaultType);
  const [legalName, setLegalName] = useState("");
  const [tin, setTin] = useState("");
  const [line1, setLine1] = useState(defaultAddress?.line1 ?? "");
  const [line2, setLine2] = useState(defaultAddress?.line2 ?? "");
  const [city, setCity] = useState(defaultAddress?.city ?? "");
  const [state, setState] = useState(defaultAddress?.state ?? "");
  const [postalCode, setPostalCode] = useState(defaultAddress?.postalCode ?? "");
  const [country, setCountry] = useState(defaultAddress?.country ?? "US");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/seller/tax-form", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formType,
          legalName: legalName.trim(),
          tin: tin.trim(),
          address: {
            line1: line1.trim(),
            line2: line2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            postalCode: postalCode.trim(),
            country: country.trim().toUpperCase(),
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(
          j.error === "invalid_tin"
            ? "TIN looks too short — should be 9 digits."
            : j.message || "Could not save",
        );
        return;
      }
      setMsg("Saved.");
      setLegalName("");
      setTin("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none";

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm"
    >
      <div className="flex gap-2">
        {(["W9", "W8"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFormType(t)}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              formType === t
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-white/10 text-paper/60"
            }`}
          >
            {t === "W9" ? "W-9 (US)" : "W-8BEN (non-US)"}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Legal name (or business name)
        </label>
        <input
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          required
          className={inp}
          placeholder="Jane Doe / Acme LLC"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          TIN (SSN, EIN, ITIN — digits only)
        </label>
        <input
          value={tin}
          onChange={(e) => setTin(e.target.value)}
          required
          inputMode="numeric"
          className={`${inp} font-mono`}
          placeholder="123456789"
          autoComplete="off"
        />
        <p className="mt-1 text-[10px] text-paper/40">
          Encrypted at rest. We only show the last 4 digits anywhere
          internally.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Street address"
          required
          className={`${inp} sm:col-span-2`}
        />
        <input
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          placeholder="Apt / Suite (optional)"
          className={`${inp} sm:col-span-2`}
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          required
          className={inp}
        />
        <input
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="State"
          required
          className={inp}
        />
        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="ZIP / Postal code"
          required
          className={inp}
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (2-letter)"
          maxLength={2}
          required
          className={`${inp} uppercase`}
        />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-6 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Submit tax form"}
        </button>
      </div>
    </form>
  );
}
