"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Existing {
  rating: number;
  body: string | null;
}

// Compact 5-star picker + optional textarea. POSTs to
// /api/orders/[id]/review which upserts so re-submitting updates the
// existing review. Disabled until rating > 0 to make accidental
// clicks safe.
export default function ReviewForm({
  orderId,
  initial,
}: {
  orderId: string;
  initial: Existing | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setErr("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, body: body.trim() || undefined }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Could not save review");
      return;
    }
    setMsg(initial ? "Review updated." : "Thanks for the review.");
    router.refresh();
  }

  const display = hover || rating;

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        {initial ? "Your review" : "Leave a review"}
      </p>
      <div
        className="mt-3 flex items-center gap-1 text-3xl"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="transition hover:scale-110"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <span className={n <= display ? "text-amber-300" : "text-paper/20"}>
              ★
            </span>
          </button>
        ))}
        <span className="ml-2 text-xs text-paper/50">
          {display ? `${display}/5` : "Pick a rating"}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Optional — tell other buyers what was good (or wasn't)."
        rows={3}
        maxLength={2000}
        className="mt-3 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
      {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy || rating < 1}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : initial ? "Update review" : "Submit review"}
        </button>
      </div>
    </form>
  );
}
