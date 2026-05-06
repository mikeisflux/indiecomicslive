"use client";

// Floating reactions (TikTok / YouTube style). Each reaction renders
// for ~4s, drifting upward with a small horizontal sway, then unmounts
// itself via the parent's setTimeout.

const STICKERS: Record<string, string> = {
  heart: "❤️",
  fire: "🔥",
  wow: "😮",
  laugh: "😂",
  money: "💸",
  comic: "💥",
};

export interface ReactionEvent {
  id: string;
  kind: string;
  at: number;
}

export default function ReactionLayer({
  reactions,
}: {
  reactions: ReactionEvent[];
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {reactions.map((r) => {
        // Per-reaction random offset so they don't stack.
        const seed = (Number(r.id.split("-")[0]) % 100) / 100;
        const sticker = STICKERS[r.kind] ?? "❤️";
        const left = 5 + seed * 80; // 5%..85%
        const sway = (seed - 0.5) * 60; // -30..30 px
        return (
          <span
            key={r.id}
            className="absolute bottom-2 select-none"
            style={{
              left: `${left}%`,
              fontSize: 28,
              animation: "icl-rxn-rise 4s ease-out forwards",
              transform: `translateX(${sway}px)`,
              willChange: "transform, opacity",
            }}
          >
            {sticker}
          </span>
        );
      })}
      <style>{`
        @keyframes icl-rxn-rise {
          0%   { transform: translate(0, 0) scale(1);   opacity: 0; }
          10%  { transform: translate(0, -20px) scale(1.1); opacity: 1; }
          90%  { transform: translate(0, -85vh) scale(0.85); opacity: 0.85; }
          100% { transform: translate(0, -90vh) scale(0.6);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function ReactionBar({
  onTap,
}: {
  onTap: (kind: string) => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col gap-1 rounded-full border border-white/15 bg-black/60 p-1 backdrop-blur">
      {Object.entries(STICKERS).map(([kind, glyph]) => (
        <button
          key={kind}
          type="button"
          onClick={() => onTap(kind)}
          className="rounded-full px-2 py-1 text-2xl transition hover:scale-125"
          aria-label={kind}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}
