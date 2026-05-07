"use client";

import { useEffect, useState } from "react";

// Top-right entries badge that ticks up live as viewers tap Enter on
// an open giveaway. Polls /api/shows/[id]/giveaways every 8s and
// surfaces the top open giveaway's entry count. Hidden when there's
// no open giveaway.
export default function GiveawayEntriesPill({ showId }: { showId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/shows/${showId}/giveaways`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const data = (await r.json()) as {
          items?: { status: string; entries: number }[];
        };
        const open = (data.items ?? []).find((g) => g.status === "open");
        if (!cancelled) setCount(open ? open.entries : null);
      } catch {
        /* swallow */
      }
    }
    load();
    const t = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [showId]);

  if (count === null) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl bg-black/55 px-3 py-1.5 text-xs backdrop-blur-md">
      <span
        aria-hidden
        className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"
      >
        ✓
      </span>
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-paper">Giveaway</span>
        <span className="text-[10px] text-paper/70">
          {count.toLocaleString()} {count === 1 ? "entry" : "entries"}
        </span>
      </div>
    </div>
  );
}
