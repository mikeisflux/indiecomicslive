"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASONS = [
  { v: "lost_in_transit", label: "Lost in transit" },
  { v: "damaged_in_transit", label: "Damaged in transit" },
  { v: "carrier_loss", label: "Carrier loss / acknowledged" },
  { v: "porch_theft", label: "Porch theft" },
  { v: "other", label: "Other" },
] as const;

// Buyer / seller insurance claim filing card. Surfaces under the
// dispute form on the order page when the order is shipped or
// delivered. Distinct from the dispute pipeline — disputes are
// buyer ↔ seller; insurance is filed against the platform's reserve.
export default function InsuranceClaimForm({
  orderId,
  maxAmountCents,
  alreadyOpen,
}: {
  orderId: string;
  maxAmountCents: number;
  alreadyOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["v"]>(
    "lost_in_transit",
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(((maxAmountCents ?? 0) / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (alreadyOpen) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
        Insurance claim already on file — our team is reviewing.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/15 bg-white/[0.02] px-4 py-1.5 text-xs font-semibold text-paper/70 hover:border-amber-400/60 hover:text-amber-200"
      >
        File an insurance claim
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 20) {
      setErr("Tell us what happened — at least 20 characters.");
      return;
    }
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setErr("Claim amount must be at least $1.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/insurance-claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          description: description.trim(),
          amountCents: cents,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || j.error || "Could not file claim");
        return;
      }
      setMsg("Filed. Our team will review and email you.");
      setDescription("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
        Insurance claim
      </p>
      <p className="text-xs text-paper/60">
        For loss / damage by the carrier. Distinct from the dispute
        flow — we reimburse out of our reserve.
      </p>
      <div>
        <label className="mb-1 block text-xs text-paper/60">Reason</label>
        <select
          className={inp}
          value={reason}
          onChange={(e) =>
            setReason(e.target.value as (typeof REASONS)[number]["v"])
          }
        >
          {REASONS.map((r) => (
            <option key={r.v} value={r.v}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Claim amount ($)
        </label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inp} font-mono`}
        />
        <p className="mt-1 text-[10px] text-paper/40">
          Capped to the order total ($
          {(maxAmountCents / 100).toFixed(2)}).
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          What happened?
        </label>
        <textarea
          className={`${inp} min-h-[110px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minLength={20}
          maxLength={5000}
          required
          placeholder="Tracking, dates, photos, carrier acknowledgement — anything we can lean on."
        />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-white/15 px-4 py-2 text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Filing…" : "File claim"}
        </button>
      </div>
    </form>
  );
}
