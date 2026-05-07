"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cam {
  id: string;
  label: string;
}

// Extra-cam registration for multi-cam break setups (close-up cam,
// side cam, etc). Each cam corresponds to a separate AMS broadcast
// the seller publishes in parallel; the viewer page surfaces a small
// picker on the player to swap between them.
export default function CameraSettings({
  showId,
  initial,
}: {
  showId: string;
  initial: Cam[];
}) {
  const router = useRouter();
  const [cams, setCams] = useState<Cam[]>(initial);
  const [streamId, setStreamId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function persist(next: Cam[]) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/seller/shows/${showId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraStreamIds: next }),
      });
      if (!r.ok) {
        setErr("Could not save cameras.");
        return;
      }
      setCams(next);
      setMsg("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!streamId.trim() || !label.trim()) return;
    if (cams.length >= 3) {
      setErr("Up to 3 extra cameras.");
      return;
    }
    if (cams.some((c) => c.id === streamId.trim())) {
      setErr("That stream id is already registered.");
      return;
    }
    persist([...cams, { id: streamId.trim(), label: label.trim() }]).then(
      () => {
        setStreamId("");
        setLabel("");
      },
    );
  }

  function remove(id: string) {
    persist(cams.filter((c) => c.id !== id));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-bold">Multi-cam (3-cam break)</h3>
      <p className="mt-1 text-xs text-paper/60">
        Publish extra streams from OBS or a second device with these
        stream IDs. Viewers get a Main / Cam-2 / Cam-3 picker on the
        player.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Close-up)"
          maxLength={40}
          className="w-40 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          placeholder="Stream id (from OBS)"
          maxLength={120}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={add}
          disabled={busy || !streamId.trim() || !label.trim() || cams.length >= 3}
          className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      {msg && <p className="mt-2 text-xs text-emerald-300">{msg}</p>}

      {cams.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {cams.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
            >
              <div className="flex flex-col">
                <span className="font-bold">{c.label}</span>
                <span className="font-mono text-paper/40">{c.id}</span>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="rounded-full border border-white/15 px-3 py-1 text-paper/60 hover:border-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
