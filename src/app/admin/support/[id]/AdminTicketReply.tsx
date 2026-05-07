"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { v: "awaiting_user", label: "Reply (await user)" },
  { v: "resolved", label: "Resolve + close" },
  { v: "open", label: "Re-open" },
] as const;

export default function AdminTicketReply({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] =
    useState<(typeof STATUSES)[number]["v"]>("awaiting_user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/support/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim(), status }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.message || j.error || "Could not send");
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={5000}
        placeholder="Reply to the buyer…"
        className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-paper/40">
          Status (current: {currentStatus.replace("_", " ")})
        </p>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setStatus(s.v)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === s.v
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-white/10 text-paper/60"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="ml-auto rounded-full bg-accent px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </form>
  );
}
