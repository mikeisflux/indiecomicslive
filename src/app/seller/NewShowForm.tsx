"use client";
import { useState } from "react";

export default function NewShowForm() {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    rtmp: { url: string; streamKey: string };
    show: { id: string };
  }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/shows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-semibold">Stream created.</p>
        <div>
          <label className="text-xs text-paper/60">RTMP URL</label>
          <input
            readOnly
            value={result.rtmp.url}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-paper/60">Stream key</label>
          <input
            readOnly
            value={result.rtmp.streamKey}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
          />
        </div>
        <a
          href={`/seller/${result.show.id}`}
          className="inline-block rounded-full bg-accent px-4 py-2 font-semibold text-white"
        >
          Open show
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Show title"
        required
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      <button
        disabled={submitting}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create show"}
      </button>
    </form>
  );
}
