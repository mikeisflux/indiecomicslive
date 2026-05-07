"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { cents: 100, label: "$1", sticker: "🎉" },
  { cents: 500, label: "$5", sticker: "🔥" },
  { cents: 1000, label: "$10", sticker: "💸" },
  { cents: 2500, label: "$25", sticker: "🚀" },
  { cents: 5000, label: "$50", sticker: "💥" },
] as const;

// Tip button that pops a small panel with preset amounts. On confirm,
// charges the buyer's default DC card and the WS broadcast lands a
// confetti + leaderboard update on every connected viewer. Shown
// during a live show next to the reaction bar.
export default function TipButton({
  showId,
  signedIn,
}: {
  showId: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pickedCents, setPickedCents] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(cents: number, sticker?: string) {
    if (!signedIn) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/sign-in?callbackUrl=${next}`;
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/shows/${showId}/tip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          message: message.trim() || undefined,
          sticker,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || j.error || "Tip declined");
        return;
      }
      setMsg(`Sent! Thanks 💖`);
      setPickedCents(null);
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setMsg(null);
        router.refresh();
      }, 1200);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
      >
        💸 Tip
      </button>
    );
  }

  return (
    <div className="icl-glass icl-glass-accent fixed inset-x-3 bottom-20 z-30 rounded-2xl p-4 sm:absolute sm:inset-x-auto sm:bottom-16 sm:right-3 sm:w-80">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Send a tip
        </p>
        <button
          onClick={() => {
            setOpen(false);
            setPickedCents(null);
          }}
          className="text-paper/50 hover:text-paper"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.cents}
            onClick={() => setPickedCents(p.cents)}
            className={`flex flex-col items-center rounded-xl border px-2 py-2 text-xs font-bold transition ${
              pickedCents === p.cents
                ? "border-accent bg-accent text-white"
                : "border-white/15 text-paper/80 hover:border-accent/50"
            }`}
          >
            <span className="text-lg">{p.sticker}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional message"
        maxLength={140}
        className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
      />
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      {msg && <p className="mt-2 text-xs text-emerald-300">{msg}</p>}
      <button
        disabled={busy || !pickedCents}
        onClick={() =>
          pickedCents &&
          send(pickedCents, PRESETS.find((p) => p.cents === pickedCents)?.sticker)
        }
        className="mt-3 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
      >
        {busy
          ? "Charging…"
          : pickedCents
            ? `Send $${(pickedCents / 100).toFixed(2)}`
            : "Pick an amount"}
      </button>
    </div>
  );
}
