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

export default function NewShowForm() {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    publish: Publish;
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
