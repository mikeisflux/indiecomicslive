"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Address {
  name?: string;
  company?: string;
  phone?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export default function ShipFromForm({ initial }: { initial: Address | null }) {
  const router = useRouter();
  const [a, setA] = useState<Address>({
    country: "US",
    ...(initial ?? {}),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Address>(k: K, v: string) {
    setA((prev) => ({ ...prev, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await fetch("/api/seller/ship-from", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || data.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs text-paper/60";

  return (
    <form onSubmit={save} className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Name <span className="text-accent">*</span></label>
          <input className={inp} required value={a.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Company</label>
          <input className={inp} value={a.company ?? ""} onChange={(e) => set("company", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={lbl}>Phone</label>
        <input className={inp} value={a.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Street <span className="text-accent">*</span></label>
        <input className={inp} required value={a.street1 ?? ""} onChange={(e) => set("street1", e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Street 2</label>
        <input className={inp} value={a.street2 ?? ""} onChange={(e) => set("street2", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>City <span className="text-accent">*</span></label>
          <input className={inp} required value={a.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>State <span className="text-accent">*</span></label>
          <input className={inp} required maxLength={2} value={a.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className={lbl}>Postal <span className="text-accent">*</span></label>
          <input className={inp} required value={a.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={lbl}>Country <span className="text-accent">*</span></label>
        <input className={inp} required maxLength={2} value={a.country ?? "US"} onChange={(e) => set("country", e.target.value.toUpperCase())} />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
