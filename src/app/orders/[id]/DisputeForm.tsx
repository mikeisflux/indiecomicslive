"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASONS = [
  { value: "not_received", label: "Item not received" },
  { value: "not_as_described", label: "Not as described" },
  { value: "damaged", label: "Arrived damaged" },
  { value: "wrong_item", label: "Wrong item sent" },
  { value: "refund_requested", label: "Refund requested" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

interface ExistingDispute {
  id: string;
  reason: string;
  status: string;
  body: string;
  createdAt: string;
}

export default function DisputeForm({
  orderId,
  existing,
}: {
  orderId: string;
  existing: ExistingDispute | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("not_as_described");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (existing) {
    return (
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Dispute · {existing.status.replace(/_/g, " ")}
        </p>
        <p className="mt-2 text-paper">
          <strong>Reason:</strong> {existing.reason.replace(/_/g, " ")}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-paper/80">{existing.body}</p>
        <p className="mt-2 text-[11px] text-paper/40">
          Opened {new Date(existing.createdAt).toLocaleString()}. Indie Comics
          Live admins are reviewing — we&rsquo;ll email you when there&rsquo;s
          an update.
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-amber-500/40 bg-amber-500/5 px-4 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-500/70"
      >
        Report an issue
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 20) {
      setErr("Tell us what happened — at least 20 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/orders/${orderId}/dispute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, body: body.trim() }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Could not open dispute");
      return;
    }
    router.refresh();
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
        Report an issue
      </p>
      <p className="text-xs text-paper/60">
        Filing here lets our team mediate before you go to your bank. Use this
        instead of a chargeback — chargebacks pre-empting a dispute are
        treated as fraud per the{" "}
        <a href="/legal/chargebacks" className="text-accent hover:underline">
          Chargebacks Policy
        </a>
        .
      </p>
      <div>
        <label className="mb-1 block text-xs text-paper/60">Reason</label>
        <select
          className={inp}
          value={reason}
          onChange={(e) => setReason(e.target.value as Reason)}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          What happened?
        </label>
        <textarea
          className={`${inp} min-h-[120px] resize-y`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={20}
          maxLength={5000}
          required
          placeholder="Describe the issue, dates, photos / tracking links if relevant."
        />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
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
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Open dispute"}
        </button>
      </div>
    </form>
  );
}
