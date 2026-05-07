"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export interface WinnerTrigger {
  // Monotonically increasing — used as the React key so a back-to-back
  // win restarts the animation cleanly.
  at: number;
  label: string;
  amountCents: number;
  avatarUrl: string | null;
}

const PALETTE = [
  "#ff3366",
  "#ff6699",
  "#fbbf24",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#f97316",
];

// Whatnot-style winner reveal:
//   1. small dot lands in the middle of the player
//   2. dot grows to a circle showing the winner's avatar (or first
//      initial when they don't have one)
//   3. winner's handle pops in below the circle in big yellow text
//   4. "Won the auction!" subtitle + final amount
//   5. fades out
// Triggered from the WS lot_closed event when sold:true.
export default function WinnerReveal({
  trigger,
}: {
  trigger: WinnerTrigger | null;
}) {
  const [active, setActive] = useState<{
    id: number;
    label: string;
    amountCents: number;
    color: string;
    initial: string;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const color = PALETTE[trigger.at % PALETTE.length];
    const initial =
      trigger.label.replace(/^@/, "").charAt(0).toUpperCase() || "·";
    setActive({
      id: trigger.at,
      label: trigger.label,
      amountCents: trigger.amountCents,
      color,
      initial,
      avatarUrl: trigger.avatarUrl,
    });
    const t = setTimeout(() => setActive(null), 4200);
    return () => clearTimeout(t);
  }, [trigger?.at, trigger?.label, trigger?.amountCents, trigger?.avatarUrl]);

  if (!active) return null;

  return (
    <div
      key={active.id}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <div className="relative flex flex-col items-center">
        <div
          className="icl-winner-circle relative grid place-items-center overflow-hidden rounded-full text-7xl font-black text-white"
          style={{
            backgroundColor: active.color,
            boxShadow: `0 0 80px ${active.color}cc, 0 0 160px ${active.color}55`,
            width: 160,
            height: 160,
          }}
        >
          {active.avatarUrl ? (
            <Image
              src={active.avatarUrl}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
            />
          ) : (
            <span>{active.initial}</span>
          )}
        </div>
        <p
          className="icl-winner-name absolute whitespace-nowrap text-center font-black tracking-tight"
          style={{
            top: 184,
            color: "#fbbf24",
            textShadow: "0 2px 14px rgba(0,0,0,0.85)",
            fontSize: 48,
            lineHeight: 1,
          }}
        >
          {active.label}
        </p>
        <p
          className="icl-winner-subtitle absolute text-center text-xl font-bold text-white"
          style={{
            top: 244,
            textShadow: "0 1px 8px rgba(0,0,0,0.85)",
          }}
        >
          Won the auction!
        </p>
        <p
          className="icl-winner-amount absolute text-center font-mono text-base font-bold"
          style={{
            top: 276,
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 8px rgba(0,0,0,0.85)",
          }}
        >
          ${(active.amountCents / 100).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

