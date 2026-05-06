"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "open", label: "Open (default)" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved (refund / fix issued)" },
  { value: "closed_no_action", label: "Closed — no action" },
] as const;

export default function DisputeResolutionForm({
  id,
  status,
  resolution,
}: {
  id: string;
  status: string;
  resolution: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [body, setBody] = useState(resolution ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await fetch(`/api/admin/disputes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        resolution: body.trim() || null,
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={save}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        Admin actions
      </p>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-paper/60">Status</label>
        <select
          className={inp}
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-paper/60">
          Resolution notes (visible to the buyer)
        </label>
        <textarea
          className={`${inp} min-h-[120px] resize-y`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          placeholder="What action was taken? Refund issued? Replacement shipped?"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
      {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
      <div className="mt-3 flex justify-end">
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
