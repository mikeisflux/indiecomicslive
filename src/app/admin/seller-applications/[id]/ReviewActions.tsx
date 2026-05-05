"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Decision = "approve" | "reject" | "request_revision";

export default function ReviewActions({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function decide(decision: Decision) {
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
        placeholder="Notes — emailed to the applicant on Reject and Request changes; visible to admins on Approve"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      <input
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        placeholder="Rejection reason (if rejecting)"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => decide("approve")}
          disabled={busy !== null}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => decide("request_revision")}
          disabled={busy !== null || !notes.trim()}
          title={!notes.trim() ? "Add notes describing what needs to change" : ""}
          className="rounded-full border border-amber-500/60 bg-amber-500/10 px-5 py-2 text-sm font-bold text-amber-300 disabled:opacity-50"
        >
          {busy === "request_revision" ? "Requesting…" : "Request changes"}
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={busy !== null}
          className="rounded-full border border-red-500/60 bg-red-500/10 px-5 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      <p className="mt-2 text-xs text-paper/50">
        <strong>Request changes</strong> sends the applicant an email with a
        link to /seller/apply and your notes — their previously-entered
        details stay saved.
      </p>
    </section>
  );
}
