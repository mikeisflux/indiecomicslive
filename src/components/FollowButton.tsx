"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Optimistic follow toggle. Bounces unauthenticated visitors to
// /sign-in?callbackUrl=… so they come back to the same shop page
// after signing in.
export default function FollowButton({
  sellerId,
  initial,
  signedIn,
}: {
  sellerId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
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
        body: JSON.stringify({ sellerId, follow: want }),
      });
      if (!r.ok) setFollowing(!want);
      else router.refresh();
    } catch {
      setFollowing(!want);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
        following
          ? "border border-white/15 text-paper/70 hover:border-red-400/60 hover:text-red-300"
          : "bg-accent text-white shadow-[0_0_18px_rgba(255,51,102,0.4)]"
      }`}
    >
      {following ? "Following" : "+ Follow"}
    </button>
  );
}
