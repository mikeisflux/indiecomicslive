"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Whatnot-style slide-to-bid pill. Touch- or mouse-drag the inner
// thumb past 70% of the track to confirm; snap back below threshold.
// Tap (desktop / a11y) also fires the bid since accidental clicks are
// less likely with a mouse than a fat finger. Haptic feedback on
// drag-start, threshold-cross, and successful confirm.
//
// Mobile-first sizing: 56px tall touch target, full width of its
// parent flex slot. The chevrons (»») hint at the swipe direction.

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* swallow */
    }
  }
}

export default function SlideToBid({
  label,
  disabled,
  onBid,
}: {
  label: string;
  disabled?: boolean;
  onBid: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [drag, setDrag] = useState(0);
  const [active, setActive] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef<number | null>(null);
  const crossedRef = useRef(false);

  useEffect(() => {
    function measure() {
      if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const THUMB = 56;
  const max = Math.max(0, trackWidth - THUMB);
  const threshold = max * 0.7;

  const start = useCallback(
    (clientX: number) => {
      if (disabled) return;
      startXRef.current = clientX;
      crossedRef.current = false;
      setActive(true);
      buzz(6);
    },
    [disabled],
  );

  const move = useCallback(
    (clientX: number) => {
      const startX = startXRef.current;
      if (startX === null) return;
      const dx = Math.max(0, Math.min(max, clientX - startX));
      setDrag(dx);
      if (!crossedRef.current && dx >= threshold) {
        crossedRef.current = true;
        buzz(12);
      }
    },
    [max, threshold],
  );

  const end = useCallback(() => {
    if (startXRef.current === null) return;
    const passed = drag >= threshold;
    setActive(false);
    startXRef.current = null;
    if (passed) {
      setConfirmed(true);
      setDrag(max);
      buzz([18, 28, 60]);
      onBid();
      setTimeout(() => {
        setConfirmed(false);
        setDrag(0);
      }, 320);
    } else {
      setDrag(0);
    }
  }, [drag, max, threshold, onBid]);

  // Tap-to-bid for desktop / accessibility — bypasses the slide.
  function onClick() {
    if (disabled) return;
    // Don't double-fire after a successful drag.
    if (drag > 0 || confirmed) return;
    buzz(20);
    onBid();
  }

  return (
    <div
      ref={trackRef}
      onTouchStart={(e) => start(e.touches[0].clientX)}
      onTouchMove={(e) => {
        if (startXRef.current !== null) {
          e.preventDefault();
          move(e.touches[0].clientX);
        }
      }}
      onTouchEnd={end}
      onTouchCancel={end}
      onMouseDown={(e) => start(e.clientX)}
      onMouseMove={(e) => {
        if (startXRef.current !== null) move(e.clientX);
      }}
      onMouseUp={end}
      onMouseLeave={end}
      onClick={onClick}
      className={`relative flex h-14 min-w-[180px] flex-1 select-none items-center justify-center overflow-hidden rounded-full bg-accent/20 text-sm font-bold tracking-tight text-white touch-none ${
        disabled ? "opacity-40" : "cursor-pointer"
      }`}
      role="button"
      aria-label={label}
      aria-disabled={disabled}
    >
      {/* Filled progress bar that grows under the thumb */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-accent/40"
        style={{
          width: `${drag + THUMB}px`,
          transition: active ? "none" : "width 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      <span className="relative z-10 mx-3 flex items-center gap-2">
        {confirmed ? <span aria-hidden>✓</span> : null}
        {label}
        <span aria-hidden className={confirmed ? "opacity-0" : "opacity-80"}>
          »»
        </span>
      </span>

      {/* Draggable thumb */}
      <span
        aria-hidden
        className="absolute top-1 grid place-items-center rounded-full bg-accent text-white shadow-[0_0_18px_rgba(255,51,102,0.55)]"
        style={{
          width: THUMB - 8,
          height: THUMB - 8,
          left: `${drag + 4}px`,
          transition: active ? "none" : "left 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <span className="text-xl leading-none">»</span>
      </span>
    </div>
  );
}
