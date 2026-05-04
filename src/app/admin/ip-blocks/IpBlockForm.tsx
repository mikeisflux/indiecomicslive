"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IpBlockForm() {
  const router = useRouter();
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/ip-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ipAddress: ip,
        reason: reason || undefined,
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Failed");
      return;
    }
    setIp("");
    setReason("");
    setExpiresAt("");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <label className="text-xs text-paper/60">
        IP / CIDR
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          required
          placeholder="1.2.3.4 or 1.2.3.0/24"
          className="mt-1 block w-44 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-paper/60">
        Reason
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="abuse / fraud"
          className="mt-1 block w-64 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-paper/60">
        Expires (optional)
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={busy}
        className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Adding…" : "Block IP"}
      </button>
      {error && <p className="w-full text-sm text-red-300">{error}</p>}
    </form>
  );
}
