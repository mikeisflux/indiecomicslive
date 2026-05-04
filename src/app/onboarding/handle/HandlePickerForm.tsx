"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HandlePickerForm({ next }: { next: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/account/handle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: handle.toLowerCase() }),
    });
    const data = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) {
      setError(data.error ?? "Could not save handle");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center rounded-lg border border-white/10 bg-black/40">
        <span className="pl-3 text-paper/60">@</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]+"
          required
          autoFocus
          autoComplete="off"
          placeholder="yourname"
          className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
        />
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
      <button
        disabled={submitting}
        className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save handle"}
      </button>
    </form>
  );
}
