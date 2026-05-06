"use client";

import { useState } from "react";

// Inline max-bid widget. Shown next to the manual bid bar in the live
// show. Stores a ceiling — the engine handles the auto-bidding.
export default function AutoBidButton({
  lotId,
  initialMaxDollars,
}: {
  lotId: string;
  initialMaxDollars: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(
    initialMaxDollars ? String(initialMaxDollars) : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeMax, setActiveMax] = useState<number | null>(initialMaxDollars);

  async function save() {
    const n = Number(val);
    if (!isFinite(n) || n < 1) {
      setErr("Enter your max in dollars (e.g. 50).");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/lots/${lotId}/auto-bid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxDollars: n }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error || "Could not save auto-bid");
        return;
      }
      setActiveMax(n);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await fetch(`/api/lots/${lotId}/auto-bid`, { method: "DELETE" });
      setActiveMax(null);
      setVal("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          activeMax
            ? "border-accent/60 bg-accent/15 text-accent"
            : "border-white/15 text-paper/60 hover:border-white/30 hover:text-paper"
        }`}
      >
        {activeMax ? `Auto-bid · max $${activeMax}` : "+ Auto-bid"}
      </button>
    );
  }
  return (
    <div className="icl-glass flex items-center gap-1.5 rounded-full p-1.5 text-xs">
      <span className="px-1 text-paper/60">Max $</span>
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setOpen(false);
        }}
        inputMode="decimal"
        className="w-16 rounded-full bg-black/40 px-2 py-1 text-sm focus:outline-none"
        placeholder="50"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "…" : "Set"}
      </button>
      {activeMax && (
        <button
          onClick={cancel}
          className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-paper/60 hover:border-red-400 hover:text-red-300"
        >
          Cancel
        </button>
      )}
      {err && <span className="text-xs text-red-300">{err}</span>}
    </div>
  );
}
