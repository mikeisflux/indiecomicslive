"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  kind: "lot" | "show";
  id: string;
  /** Initial state: are we already watching this? */
  initial: boolean;
  /** Tiny variant fits inside a card corner; default is the larger pill. */
  size?: "sm" | "md";
  /** Hide the text label for icon-only display. */
  iconOnly?: boolean;
}

// Heart toggle that POSTs /api/watch. Optimistic UI: flip immediately,
// revert if the request fails. For unauthenticated visitors we redirect
// to /sign-in with a callback back here.
export default function WatchButton({
  kind,
  id,
  initial,
  size = "md",
  iconOnly = false,
}: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !watching;
    setWatching(next); // optimistic
    const r = await fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id, watch: next }),
    });
    setBusy(false);
    if (r.status === 401) {
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      setWatching(initial); // revert
      return;
    }
    if (!r.ok) {
      setWatching(!next); // revert
    }
  }

  const padding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={watching}
      aria-label={watching ? "Unwatch" : "Watch"}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border ${padding} ${fontSize} font-semibold transition disabled:opacity-50 ${
        watching
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-white/15 bg-black/40 text-paper/80 hover:border-white/30"
      }`}
    >
      <span aria-hidden className={watching ? "" : "opacity-70"}>
        {watching ? "♥" : "♡"}
      </span>
      {!iconOnly && <span>{watching ? "Watching" : "Watch"}</span>}
    </button>
  );
}
