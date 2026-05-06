"use client";

import { useState } from "react";
import type { Lot } from "./SellerControls";

interface Props {
  showId: string;
  lots: Lot[];
  pinnedLotId: string | null;
  onChange: (id: string | null) => void;
}

// Sets / clears the show's "now selling" pin. Buyers in the watch
// stream see the pinned lot as a highlighted card overlaying the
// video. Useful when:
//   - the seller wants to spotlight an upcoming lot ("next up")
//   - a Buy-Now lot is open and they want it visible while talking
//   - the auction engine is between lots and they want to tease one
export default function PinControl({
  showId,
  lots,
  pinnedLotId,
  onChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setPin(lotId: string | null) {
    setBusy(lotId ?? "clear");
    setErr(null);
    const r = await fetch(`/api/seller/shows/${showId}/pin`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lotId }),
    });
    setBusy(null);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setErr(data.error ?? "pin_failed");
      return;
    }
    onChange(lotId);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
          Now selling
        </p>
        {pinnedLotId ? (
          (() => {
            const lot = lots.find((l) => l.id === pinnedLotId);
            return (
              <div className="mt-3 flex items-center gap-3">
                {lot?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lot.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-white/5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{lot?.title ?? "(unknown lot)"}</p>
                  <p className="text-xs text-paper/60">
                    Buyers see this lot pinned in the stream.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPin(null)}
                  disabled={busy !== null}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-red-300/50 hover:text-red-300 disabled:opacity-40"
                >
                  {busy === "clear" ? "Clearing…" : "Unpin"}
                </button>
              </div>
            );
          })()
        ) : (
          <p className="mt-2 text-sm text-paper/60">
            Nothing pinned. Pick a lot below to spotlight it for viewers.
          </p>
        )}
        {err && <p className="mt-2 text-xs text-accent">{err}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-paper/60">
          Choose a lot to pin
        </p>
        {lots.length === 0 ? (
          <p className="text-sm text-paper/40">No lots in this show yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {lots.map((l) => {
              const isPinned = l.id === pinnedLotId;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setPin(isPinned ? null : l.id)}
                    disabled={busy !== null}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition disabled:opacity-50 ${
                      isPinned
                        ? "border-accent/60 bg-accent/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.title}</p>
                      <p className="text-xs text-paper/60">
                        Start ${(l.startingBidCents / 100).toFixed(2)} · {l.status}
                      </p>
                    </div>
                    {isPinned && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                        Pinned
                      </span>
                    )}
                    {busy === l.id && (
                      <span className="text-xs text-paper/60">…</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
