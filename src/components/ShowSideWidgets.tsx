"use client";

import { useEffect, useState } from "react";

interface LeaderRow {
  buyerId: string;
  label: string;
  totalCents: number;
  wins: number;
}

interface Giveaway {
  id: string;
  prize: string;
  description: string | null;
  status: "open" | "closed" | "drawn" | "cancelled";
  entries: number;
  winner: string | null;
  closesAt: string | null;
}

// Widgets that hang off the side of the live show page:
//   1. Top buyers leaderboard for this show
//   2. Active giveaways with one-tap Enter
// Both poll every 10s — chatty but lightweight, and lets us avoid a
// new WS event type until it's worth the complexity.
export default function ShowSideWidgets({
  showId,
  signedIn,
}: {
  showId: string;
  signedIn: boolean;
}) {
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);

  async function load() {
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/shows/${showId}/leaderboard`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
        fetch(`/api/shows/${showId}/giveaways`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
      ]);
      setLeaders(a.items ?? []);
      setGiveaways(b.items ?? []);
    } catch {
      /* swallow */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [showId]);

  const active = giveaways.filter((g) => g.status === "open");
  const recent = giveaways.filter((g) => g.status !== "open").slice(0, 3);

  if (leaders.length === 0 && giveaways.length === 0) return null;

  return (
    <aside className="space-y-3 px-4 py-3">
      {active.length > 0 && (
        <section className="icl-glass icl-glass-accent rounded-xl p-3">
          <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            <span className="icl-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Live giveaway
          </h3>
          {active.map((g) => (
            <GiveawayRow key={g.id} g={g} signedIn={signedIn} onEntered={load} />
          ))}
        </section>
      )}

      {leaders.length > 0 && (
        <section className="icl-glass rounded-xl p-3 text-sm">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-paper/40">
            Top buyers · this show
          </h3>
          <ol className="space-y-1.5">
            {leaders.slice(0, 5).map((r, i) => (
              <li
                key={r.buyerId}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 text-paper/40">#{i + 1}</span>
                  <span className="text-paper">{r.label}</span>
                </span>
                <span className="font-mono text-accent">
                  ${(r.totalCents / 100).toFixed(0)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recent.length > 0 && (
        <section className="icl-glass rounded-xl p-3 text-xs text-paper/60">
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-paper/40">
            Recent giveaways
          </h3>
          <ul className="space-y-1">
            {recent.map((g) => (
              <li key={g.id}>
                <span className="text-paper/80">{g.prize}</span>
                {" — "}
                {g.winner ? (
                  <span className="text-emerald-300">won by {g.winner}</span>
                ) : (
                  <span className="text-paper/50">{g.status}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function GiveawayRow({
  g,
  signedIn,
  onEntered,
}: {
  g: Giveaway;
  signedIn: boolean;
  onEntered: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enter() {
    if (!signedIn) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/sign-in?callbackUrl=${next}`;
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/giveaways/${g.id}/enter`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error || "Could not enter");
        return;
      }
      setEntered(true);
      onEntered();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-bold text-paper">
          🎁 {g.prize}
        </p>
        {g.description && (
          <p className="line-clamp-1 text-[11px] text-paper/60">
            {g.description}
          </p>
        )}
        <p className="text-[10px] text-paper/40">
          {g.entries} entr{g.entries === 1 ? "y" : "ies"}
          {g.closesAt && ` · closes ${new Date(g.closesAt).toLocaleTimeString()}`}
        </p>
      </div>
      <button
        onClick={enter}
        disabled={busy || entered}
        className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
          entered
            ? "border border-emerald-400/40 text-emerald-300"
            : "bg-accent text-white shadow-[0_0_14px_rgba(255,51,102,0.5)]"
        }`}
      >
        {entered ? "Entered" : busy ? "…" : "Enter"}
      </button>
      {err && <span className="text-[10px] text-red-300">{err}</span>}
    </div>
  );
}
