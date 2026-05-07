"use client";

import { useRef } from "react";

interface Chapter {
  lotId: string;
  title: string;
  offsetSec: number;
}

// Replay player + chapter strip. Each chapter knows the offset (in
// seconds) from the moment the show went live to the moment that
// lot opened. Tap a chapter to seek the <video>.
export default function RecordingPlayer({
  src,
  poster,
  chapters,
}: {
  src: string;
  poster: string | null;
  chapters: Chapter[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function seek(offsetSec: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, offsetSec);
    v.play().catch(() => {});
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-1">
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full bg-black object-contain"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-paper backdrop-blur">
          Replay
        </span>
      </div>
      {chapters.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <ul className="flex items-end gap-1.5">
            {chapters.map((c, i) => (
              <li key={c.lotId} className="shrink-0">
                <button
                  onClick={() => seek(c.offsetSec)}
                  className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-paper/90 backdrop-blur hover:border-accent/60 hover:text-accent"
                >
                  <span className="text-paper/40">#{i + 1}</span>{" "}
                  <span className="line-clamp-1 inline-block max-w-[160px] align-middle">
                    {c.title}
                  </span>{" "}
                  <span className="font-mono text-paper/50">
                    {fmt(c.offsetSec)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}
