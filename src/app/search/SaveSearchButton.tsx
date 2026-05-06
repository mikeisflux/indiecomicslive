"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Save this search" / "Saved" toggle. POST creates a SavedSearch
// row; the daily cron will email new matches. Clicking when already
// saved is a no-op (we don't expose delete here; manage from
// /account/saved-searches).
export default function SaveSearchButton({
  query,
  alreadySaved,
}: {
  query: string;
  alreadySaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(alreadySaved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    setBusy(false);
    if (r.status === 401) {
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(
          `/search?q=${encodeURIComponent(query)}`,
        )}`,
      );
      return;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Could not save");
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        ★ Saved · we&rsquo;ll email new matches
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:border-white/30 disabled:opacity-50"
      >
        {busy ? "Saving…" : "★ Save this search"}
      </button>
      {err && <span className="text-xs text-red-300">{err}</span>}
    </>
  );
}
