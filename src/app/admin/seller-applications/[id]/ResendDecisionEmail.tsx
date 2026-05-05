"use client";

import { useState } from "react";

export default function ResendDecisionEmail({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(
      `/api/admin/seller-applications/${applicationId}/resend`,
      { method: "POST" },
    );
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(`Failed: ${data.error ?? "unknown"}`);
      return;
    }
    setMsg(
      data.ok
        ? "Email re-sent."
        : "SendGrid rejected the message — check pm2 logs for details.",
    );
  }

  const label =
    status === "approved"
      ? "Resend approval email"
      : status === "needs_revision"
        ? "Resend revision request"
        : status === "rejected"
          ? "Resend rejection email"
          : "Resend decision email";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
        Notifications
      </h2>
      <p className="mb-3 text-xs text-paper/60">
        Re-send the {status.replace(/_/g, " ")} email to the applicant&rsquo;s
        on-file address. Useful when SendGrid bounced the first attempt
        (e.g. before the sender was verified).
      </p>
      <button
        onClick={resend}
        disabled={busy}
        className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-paper hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? "Sending…" : label}
      </button>
      {msg && <p className="mt-2 text-xs text-paper/70">{msg}</p>}
    </div>
  );
}
