"use client";

import Link from "next/link";
import { useState } from "react";

// Right-edge action stack on the live player — Whatnot-style.
// Vertical column of small icon buttons sitting on top of the video:
//   More — drops a popover with extra actions (mute, report)
//   Clip — saves a 30s replay snippet (stub for now; opens a toast)
//   Share — fires native share sheet on mobile, popover on desktop
//   Wallet — quick link to the buyer's payment-method page
//   Shop — quick link to the seller's 24/7 shop with a badge

interface Props {
  showId: string;
  sellerHandle: string | null;
  shopBadgeCount?: number;
  walletBalanceLabel?: string | null;
  shareCount?: number;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
      <path d={d} />
    </svg>
  );
}

const SHARE_PATH =
  "M18 8a3 3 0 1 0-2.83-2H15a3 3 0 0 0-.17 1L9 10.6a3 3 0 1 0 0 2.8l5.83 3.6a3 3 0 1 0 .83-1.7L9.83 11.7a3 3 0 0 0 0-3.4l5.83-3.6A3 3 0 0 0 18 8Z";
const CLIP_PATH =
  "M4 6h16v12H4V6Zm2 2v8h12V8H6Zm9 4 5 3v-6l-5 3Z";
const WALLET_PATH =
  "M21 7H5V5h14a1 1 0 0 1 1 1Zm0 2H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h16a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1Zm-3 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z";
const MORE_PATH =
  "M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z";

function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.(6);
    } catch {
      /* swallow */
    }
  }
}

export default function ShowSideRail({
  showId,
  sellerHandle,
  shopBadgeCount,
  walletBalanceLabel,
  shareCount,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [clipMsg, setClipMsg] = useState<string | null>(null);

  const text =
    "Live auction on Indie Comics Live — sub-second WebRTC bidding, indie sellers.";

  async function shareNow() {
    buzz();
    const url =
      typeof window !== "undefined"
        ? window.location.origin + `/s/${showId}`
        : `/s/${showId}`;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator
        .share({ url, title: "Indie Comics Live", text })
        .catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setClipMsg("Link copied");
      setTimeout(() => setClipMsg(null), 1400);
    } catch {
      window.open(
        `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer,width=600,height=540",
      );
    }
  }

  function clip() {
    buzz();
    setClipMsg("Clip queued — we'll email you the link.");
    setTimeout(() => setClipMsg(null), 2200);
    // TODO: hit a /api/shows/[id]/clip endpoint that triggers AMS to
    // mux the last 30s. Stub for now.
  }

  return (
    <div className="pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3">
      <RailButton
        onClick={() => {
          buzz();
          setMoreOpen((v) => !v);
        }}
        label="More"
        icon={<Icon d={MORE_PATH} />}
      />

      <RailButton
        onClick={clip}
        label="Clip"
        icon={<Icon d={CLIP_PATH} />}
      />

      <RailButton
        onClick={shareNow}
        label="Share"
        icon={<Icon d={SHARE_PATH} />}
        badge={typeof shareCount === "number" ? String(shareCount) : undefined}
      />

      <RailLink
        href="/account/payment-method"
        label="Wallet"
        icon={<Icon d={WALLET_PATH} />}
        badge={walletBalanceLabel ?? undefined}
      />

      {sellerHandle && (
        <Link
          href={`/shop/${sellerHandle}`}
          onClick={buzz}
          aria-label="Open seller shop"
          className="pointer-events-auto relative grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/55 text-xs font-bold text-paper/80 backdrop-blur-md hover:border-accent/60 hover:text-accent"
        >
          <span className="text-base">🛍</span>
          {typeof shopBadgeCount === "number" && shopBadgeCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(255,51,102,0.55)]">
              {shopBadgeCount > 99 ? "99+" : shopBadgeCount}
            </span>
          )}
          <span className="absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-paper/70">
            Shop
          </span>
        </Link>
      )}

      {clipMsg && (
        <p className="pointer-events-none absolute -left-48 top-1/2 -translate-y-1/2 rounded-lg bg-black/80 px-3 py-1.5 text-[11px] text-paper backdrop-blur">
          {clipMsg}
        </p>
      )}

      {moreOpen && (
        <div className="pointer-events-auto absolute right-14 top-0 w-44 rounded-xl border border-white/10 bg-black/85 p-1 text-sm backdrop-blur-md">
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-paper/80 hover:bg-white/5"
            onClick={() => setMoreOpen(false)}
          >
            Mute audio
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-paper/80 hover:bg-white/5"
            onClick={() => {
              setMoreOpen(false);
              window.open(
                `mailto:report@indiecomicslive.com?subject=Report%20show%20${showId}`,
                "_self",
              );
            }}
          >
            Report show
          </button>
          <Link
            href="/account/help"
            className="block rounded-lg px-3 py-2 text-paper/80 hover:bg-white/5"
            onClick={() => setMoreOpen(false)}
          >
            Get help
          </Link>
        </div>
      )}
    </div>
  );
}

function RailButton({
  onClick,
  label,
  icon,
  badge,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto relative grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/55 text-paper/85 backdrop-blur-md transition active:scale-90 hover:border-accent/60 hover:text-accent"
    >
      {icon}
      {badge && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(255,51,102,0.55)]">
          {badge}
        </span>
      )}
      <span className="absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-paper/70">
        {label}
      </span>
    </button>
  );
}

function RailLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      onClick={buzz}
      aria-label={label}
      className="pointer-events-auto relative grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/55 text-paper/85 backdrop-blur-md transition active:scale-90 hover:border-accent/60 hover:text-accent"
    >
      {icon}
      {badge && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(255,51,102,0.55)]">
          {badge}
        </span>
      )}
      <span className="absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-paper/70">
        {label}
      </span>
    </Link>
  );
}
