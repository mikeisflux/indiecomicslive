"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationsForm({
  initialSubscribed,
}: {
  initialSubscribed: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const r = await fetch("/api/account/notifications", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscribed }),
    });
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setErr(data.message || data.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={subscribed}
          onChange={(e) => setSubscribed(e.target.checked)}
        />
        <span>
          Send me marketing emails (new shows, featured sellers, platform
          updates).
        </span>
      </label>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}
