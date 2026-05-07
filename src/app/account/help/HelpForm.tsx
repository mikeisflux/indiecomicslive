"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HelpForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || j.error || "Could not open ticket");
        return;
      }
      setSubject("");
      setBody("");
      router.push(`/account/help/${j.id}`);
    } finally {
      setBusy(false);
    }
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none";

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm"
    >
      <div>
        <label className="mb-1 block text-xs text-paper/60">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          required
          className={inp}
          placeholder="Order didn't arrive / payout question / account access"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          What&rsquo;s going on?
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          required
          rows={6}
          className={`${inp} resize-y`}
          placeholder="Order ID, dates, what you've tried, screenshots in a follow-up reply if needed."
        />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !subject.trim() || !body.trim()}
          className="rounded-full bg-accent px-6 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
        >
          {busy ? "Opening…" : "Open ticket"}
        </button>
      </div>
    </form>
  );
}
