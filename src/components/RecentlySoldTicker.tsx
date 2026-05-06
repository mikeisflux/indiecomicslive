"use client";

import Image from "next/image";

interface Item {
  id: string;
  title: string;
  imageUrl: string | null;
  amount: string;
  seller: string;
}

// Infinite-scroll horizontal marquee of recently-sold lots.
// Built by duplicating the list inline + animating the wrapper -50%
// — clean loop with no JS jank. Pause on hover gives users a chance
// to read.
export default function RecentlySoldTicker({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-black/30 py-3 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="flex gap-3 [&:hover_>_div]:[animation-play-state:paused]">
        <div className="icl-marquee flex shrink-0 items-center gap-3 pl-3">
          {doubled.map((it, i) => (
            <div
              key={`${it.id}-${i}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3 text-xs"
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full bg-black/40">
                {it.imageUrl && (
                  <Image
                    src={it.imageUrl}
                    alt=""
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="text-paper/70">
                <span className="text-emerald-300">SOLD</span> ·{" "}
                <span className="font-mono font-bold text-paper">
                  {it.amount}
                </span>{" "}
                · <span className="line-clamp-1 max-w-[180px]">{it.title}</span>
              </span>
              <span className="text-paper/40">@{it.seller}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
