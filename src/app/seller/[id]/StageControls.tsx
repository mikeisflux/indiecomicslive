"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Giveaway {
  id: string;
  prize: string;
  status: "open" | "closed" | "drawn" | "cancelled";
  entries: number;
  winner: string | null;
}

interface Mod {
  userId: string;
  handle: string | null;
  name: string | null;
}

// Live-show host controls. Run-it-again, start a giveaway / draw it,
// add or remove a moderator, send an announcement.
export default function StageControls({ showId }: { showId: string }) {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Giveaway form
  const [prize, setPrize] = useState("");
  const [closesIn, setClosesIn] = useState("90");

  // Moderator form
  const [modHandle, setModHandle] = useState("");

  async function load() {
    try {
      const [g, m] = await Promise.all([
        fetch(`/api/shows/${showId}/giveaways`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
        fetch(`/api/shows/${showId}/moderators`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ items: [] })),
      ]);
      setGiveaways(g.items ?? []);
      setMods(m.items ?? []);
    } catch {
      /* swallow */
    }
  }

  useEffect(() => {
    load();
  }, [showId]);

  function flash(message: string) {
    setMsg(message);
    setErr(null);
    setTimeout(() => setMsg(null), 3000);
  }
  function flashErr(message: string) {
    setErr(message);
    setMsg(null);
    setTimeout(() => setErr(null), 3000);
  }

  async function runItAgain() {
    setBusy("clone");
    try {
      const r = await fetch(`/api/seller/shows/${showId}/run-it-again`, {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        flashErr(j.error || "Could not clone last lot");
        return;
      }
      flash("Cloned the last sold lot — see Lots tab.");
    } finally {
      setBusy(null);
    }
  }

  async function startGiveaway() {
    if (!prize.trim()) return;
    setBusy("giveaway");
    try {
      const r = await fetch(`/api/shows/${showId}/giveaways`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prize: prize.trim(),
          closesInSeconds: Math.max(15, Number(closesIn) || 90),
        }),
      });
      if (!r.ok) {
        flashErr("Could not start giveaway.");
        return;
      }
      setPrize("");
      flash("Giveaway opened.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function drawGiveaway(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/giveaways/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "draw" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        flashErr(j.error || "Could not draw");
        return;
      }
      flash(j.winnerId ? "Winner picked + notified." : "No entries — closed.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function cancelGiveaway(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/giveaways/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function addMod() {
    if (!modHandle.trim()) return;
    setBusy("addmod");
    try {
      const r = await fetch(`/api/shows/${showId}/moderators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: modHandle.trim() }),
      });
      if (!r.ok) {
        flashErr("Could not add — check the handle.");
        return;
      }
      setModHandle("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removeMod(userId: string) {
    setBusy(`rm-${userId}`);
    try {
      await fetch(`/api/shows/${showId}/moderators`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      {(msg || err) && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            err
              ? "border-red-400/40 bg-red-500/10 text-red-200"
              : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {err ?? msg}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Run it again</h3>
            <p className="mt-1 text-xs text-paper/60">
              Clone the last sold lot back into the queue. Same title, image,
              price.
            </p>
          </div>
          <button
            onClick={runItAgain}
            disabled={busy === "clone"}
            className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "clone" ? "…" : "Run it again"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold">Giveaway</h3>
        <p className="mt-1 text-xs text-paper/60">
          Open a giveaway — viewers tap Enter, then you draw a winner.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="What's the prize?"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
            maxLength={120}
          />
          <input
            value={closesIn}
            onChange={(e) => setClosesIn(e.target.value)}
            placeholder="90"
            className="w-20 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
            inputMode="numeric"
            title="Seconds before auto-closes"
          />
          <button
            onClick={startGiveaway}
            disabled={busy === "giveaway" || !prize.trim()}
            className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Start
          </button>
        </div>
        {giveaways.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5 text-sm">
            {giveaways.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-semibold">{g.prize}</p>
                  <p className="text-[11px] text-paper/50">
                    {g.entries} entr{g.entries === 1 ? "y" : "ies"} ·{" "}
                    {g.status}
                    {g.winner && ` · ${g.winner}`}
                  </p>
                </div>
                {g.status === "open" && (
                  <>
                    <button
                      onClick={() => drawGiveaway(g.id)}
                      disabled={busy === g.id}
                      className="rounded-full bg-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-200 disabled:opacity-50"
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => cancelGiveaway(g.id)}
                      disabled={busy === g.id}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px]"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold">Moderators</h3>
        <p className="mt-1 text-xs text-paper/60">
          Trusted viewers who can run giveaways for you and (soon) moderate
          chat.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={modHandle}
            onChange={(e) => setModHandle(e.target.value)}
            placeholder="@handle"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <button
            onClick={addMod}
            disabled={busy === "addmod"}
            className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {mods.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {mods.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs"
              >
                <span>@{m.handle ?? m.name ?? "user"}</span>
                <button
                  onClick={() => removeMod(m.userId)}
                  disabled={busy === `rm-${m.userId}`}
                  className="text-paper/40 hover:text-red-300"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold">Announce to followers</h3>
        <p className="mt-1 text-xs text-paper/60">
          Push + email blast to everyone following your shop.
        </p>
        <Link
          href="/seller/announce"
          className="mt-3 inline-flex rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold hover:border-white/30"
        >
          Open announcement composer →
        </Link>
      </div>
    </section>
  );
}
