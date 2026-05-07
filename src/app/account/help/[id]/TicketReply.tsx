"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TicketReply({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
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
        body: JSON.stringify({ body: body.trim() }),
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
        rows={4}
        maxLength={5000}
        placeholder="Add a reply…"
        className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
      />
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Reply"}
        </button>
      </div>
    </form>
  );
}
