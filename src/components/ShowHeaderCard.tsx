"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Compact seller-card overlay pinned to the top-left of the live show
// player — avatar, display name + handle, ★ rating, "Nd" = days since
// the seller's last show, and a bell button that toggles the follow
// relationship for instant push when they go live again.
export default function ShowHeaderCard({
  seller,
  reviewAvg,
  reviewCount,
  daysSinceLastShow,
  initialFollowing,
  signedIn,
}: {
  seller: {
    id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
  };
  reviewAvg: number | null;
  reviewCount: number;
  daysSinceLastShow: number | null;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/sign-in?callbackUrl=${next}`;
      return;
    }
    const want = !following;
    setFollowing(want);
    setBusy(true);
    try {
      const r = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, follow: want }),
      });
      if (!r.ok) setFollowing(!want);
      else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(8);
      }
    } catch {
      setFollowing(!want);
    } finally {
      setBusy(false);
    }
  }

  const display = seller.name ?? `@${seller.handle ?? "seller"}`;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
      <Link
        href={seller.handle ? `/shop/${seller.handle}` : "/"}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 text-xs backdrop-blur-md"
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/10">
          {seller.image ? (
            <Image
              src={seller.image}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            <span className="text-sm font-bold">
              {(display.replace(/^@/, "")[0] ?? "·").toUpperCase()}
            </span>
          )}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="truncate font-bold text-paper">{display}</span>
          <span className="flex items-center gap-1.5 text-[10px] text-paper/70">
            {reviewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-amber-300">★</span>
                <span className="font-mono">
                  {(reviewAvg ?? 0).toFixed(1)}
                </span>
              </span>
            )}
            {daysSinceLastShow !== null && (
              <>
                <span className="opacity-60">·</span>
                <span className="opacity-90">
                  {daysSinceLastShow === 0 ? "today" : `${daysSinceLastShow}d`}
                </span>
              </>
            )}
          </span>
        </div>
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={following ? "Unfollow seller" : "Follow seller"}
        className={`pointer-events-auto grid h-9 w-9 place-items-center rounded-full backdrop-blur-md transition active:scale-90 disabled:opacity-50 ${
          following
            ? "bg-accent text-white shadow-[0_0_14px_rgba(255,51,102,0.55)]"
            : "bg-black/55 text-paper/80 hover:bg-black/70"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          className="h-4 w-4"
        >
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2Z" />
        </svg>
      </button>
    </div>
  );
}
