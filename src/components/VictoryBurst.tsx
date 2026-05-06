"use client";

import { useEffect, useState } from "react";

// Triggered when the local user lands a bid and is now the high
// bidder. Shows an expanding pink ring + 12 outward-flying particles.
// Self-cleans after the animation. Designed to be mounted absolutely
// on top of the bid bar / video player.
export default function VictoryBurst({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => {
    if (trigger <= 0) return;
    setBursts((b) => [...b, trigger]);
    const t = setTimeout(() => {
      setBursts((b) => b.filter((id) => id !== trigger));
    }, 1200);
    return () => clearTimeout(t);
  }, [trigger]);

  if (bursts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      {bursts.map((id) => (
        <div key={id} className="relative">
          <div className="icl-victory-ring h-32 w-32" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const tx = Math.cos(angle) * 140;
            const ty = Math.sin(angle) * 140;
            return (
              <span
                key={i}
                className="icl-victory-particle"
                style={
                  {
                    "--tx": `${tx}px`,
                    "--ty": `${ty}px`,
                    left: "50%",
                    top: "50%",
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
