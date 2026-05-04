"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError(null);
    const r = await fetch(
      `/api/admin/seller-applications/${applicationId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewerNotes: notes || undefined,
          rejectionReason:
            decision === "reject" ? rejectReason || "manual_rejection" : undefined,
        }),
      },
    );
    setBusy(null);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
        Review
      </h2>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal reviewer notes (visible to admins, not the applicant)"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      <input
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        placeholder="Rejection reason (if rejecting)"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decide("approve")}
          disabled={busy !== null}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={busy !== null}
          className="rounded-full border border-red-500/60 bg-red-500/10 px-5 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </section>
  );
}
