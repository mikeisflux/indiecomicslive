"use client";
import { useState } from "react";

type Publish = {
  webSocketUrl: string;
  rtmpServerUrl: string;
  rtmpStreamKey: string;
  rtmpFullUrl: string;
  streamId: string;
  publishTokenExpSec: number;
};

// Up to 10 future-dated shows per seller, enforced server-side.
const MAX_SCHEDULED_HINT = 10;

export default function NewShowForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    publish: Publish;
    show: { id: string };
  }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      // The <input type=datetime-local> gives a value with no
      // timezone (e.g. "2026-05-08T19:30"). Convert to ISO 8601 in
      // the browser's local TZ before sending — server stores UTC.
      let scheduledFor: string | undefined;
      if (scheduledLocal) {
        const d = new Date(scheduledLocal);
        if (!Number.isNaN(d.getTime())) {
          scheduledFor = d.toISOString();
        }
      }
      const res = await fetch("/api/shows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          scheduledFor,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.message ?? data.error ?? "Could not create show");
        return;
      }
      setResult(await res.json());
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-semibold">Show created.</p>
        <p className="text-xs text-paper/60">
          Go live from your browser on the next page, or use OBS with the
          credentials below. Both work.
        </p>
        <a
          href={`/seller/${result.show.id}`}
          className="inline-block rounded-full bg-accent px-4 py-2 font-semibold text-white"
        >
          Open show
        </a>
      </div>
    );
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  // Default the picker's min to ~now so the browser's native UI
  // greys out past values.
  const nowLocal = (() => {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return d.toISOString().slice(0, 16);
  })();

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Show title"
        required
        className={inp}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional, shown to viewers)"
        rows={2}
        className={`${inp} resize-y`}
      />
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Schedule (optional) — up to {MAX_SCHEDULED_HINT} scheduled shows at a time
        </label>
        <input
          type="datetime-local"
          value={scheduledLocal}
          min={nowLocal}
          onChange={(e) => setScheduledLocal(e.target.value)}
          className={inp}
        />
        <p className="mt-1 text-xs text-paper/40">
          Leave blank to start immediately. Scheduled shows surface on the
          home page so viewers can plan around them.
        </p>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <button
        disabled={submitting}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create show"}
      </button>
    </form>
  );
}
