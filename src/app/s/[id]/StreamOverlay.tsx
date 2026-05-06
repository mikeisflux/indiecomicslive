"use client";

import { useEffect, useState } from "react";

type Lot = {
  id: string;
  title: string;
  imageUrl: string | null;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  bidCount: number;
  endsAt: Date | string | null;
  status: string;
  kind?: "auction" | "buy_now" | "mystery";
  buyNowCents?: number | null;
  inventoryCount?: number;
};

// Overlays drawn on top of the AntMediaPlayer:
//   - bottom-left "live now" lot card with countdown + current bid
//   - top-right "now selling" pin card (used when seller pinned a
//     non-live lot like an upcoming or Buy-Now item)
//
// Both cards are pointer-events:none so they don't block the player
// chrome. Countdown ticks once a second from `endsAt`.
export default function StreamOverlay({
  liveLot,
  pinnedLot,
}: {
  liveLot: Lot | null;
  pinnedLot: Lot | null;
}) {
  const showLive = liveLot && liveLot.status === "live";
  const showPin = pinnedLot && pinnedLot.id !== liveLot?.id;

  return (
    <>
      {showLive && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md">
          <div className="rounded-2xl border border-accent/40 bg-black/80 p-3 backdrop-blur">
            <div className="flex items-center gap-3">
              {liveLot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={liveLot.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                    Live
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-paper/50">
                    {liveLot.bidCount} bid
                    {liveLot.bidCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold">
                  {liveLot.title}
                </p>
                <p className="text-xs text-paper/70">
                  {liveLot.currentBidCents !== null ? (
                    <>
                      <span className="font-mono text-paper">
                        ${(liveLot.currentBidCents / 100).toFixed(2)}
                      </span>
                      <span className="text-paper/50">
                        {" "}
                        · next +${(liveLot.minIncrementCents / 100).toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-paper/60">
                      Start ${(liveLot.startingBidCents / 100).toFixed(2)}
                    </span>
                  )}
                </p>
              </div>
              <Countdown endsAt={liveLot.endsAt} />
            </div>
          </div>
        </div>
      )}

      {showPin && (
        <div className="absolute right-3 top-3 max-w-[60%] sm:max-w-xs">
          <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/80 p-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-widest text-paper/70">
              Now selling
            </p>
            <div className="mt-1 flex items-center gap-2">
              {pinnedLot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pinnedLot.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-md bg-white/10" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {pinnedLot.title}
                </p>
                <p className="text-xs text-paper/60">
                  {pinnedLot.kind === "buy_now" || pinnedLot.kind === "mystery"
                    ? `$${((pinnedLot.buyNowCents ?? 0) / 100).toFixed(2)}`
                    : `Start $${(pinnedLot.startingBidCents / 100).toFixed(2)}`}
                </p>
              </div>
            </div>
            {(pinnedLot.kind === "buy_now" || pinnedLot.kind === "mystery") && (
              <BuyNowButton lotId={pinnedLot.id} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BuyNowButton({ lotId }: { lotId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/lots/${lotId}/buy`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) {
      window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!r.ok) {
      setMsg(data.message || data.error || "Could not complete purchase");
      return;
    }
    window.location.href = `/orders/${data.orderId}`;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="w-full rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Charging…" : "Buy now"}
      </button>
      {msg && <p className="mt-1 text-[10px] text-red-300">{msg}</p>}
    </div>
  );
}

function Countdown({ endsAt }: { endsAt: Date | string | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [endsAt]);
  if (!endsAt) return null;
  const ends = typeof endsAt === "string" ? new Date(endsAt).getTime() : endsAt.getTime();
  const remainingMs = Math.max(0, ends - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const ending = seconds <= 5 && seconds > 0;
  const ended = seconds === 0;
  return (
    <div
      className={`shrink-0 rounded-xl px-2 py-1 text-center font-mono text-lg font-bold ${
        ended
          ? "bg-paper/10 text-paper/40"
          : ending
            ? "animate-pulse bg-accent/20 text-accent"
            : "bg-white/10 text-paper"
      }`}
      style={{ minWidth: 56 }}
    >
      {ended ? "—" : `${seconds}s`}
    </div>
  );
}
