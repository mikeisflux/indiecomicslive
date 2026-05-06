"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnnounceForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/seller/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || j.error || "Could not send");
        return;
      }
      setMsg(`Sent to ${j.recipients} follower${j.recipients === 1 ? "" : "s"}.`);
      setSubject("");
      setBody("");
      setUrl("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none";

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <div>
        <label className="mb-1 block text-xs text-paper/60">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          required
          className={inp}
          placeholder="Going live in 30 minutes"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          required
          rows={5}
          className={`${inp} resize-y`}
          placeholder="What's coming up — auctions, pulls, restocks…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Link (optional)
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inp}
          placeholder="https://indiecomicslive.com/s/..."
          type="url"
        />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !subject.trim() || !body.trim()}
          className="rounded-full bg-accent px-6 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send to followers"}
        </button>
      </div>
    </form>
  );
}
