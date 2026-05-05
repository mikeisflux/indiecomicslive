"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Manual refresh + auto-poll. Polls /admin/inbox every 30s by default
// for new mail and re-renders the server component via router.refresh().
export default function RefreshButton({
  intervalMs = 30_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      router.refresh();
      setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(t);
  }, [auto, intervalMs, router]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={() => {
          router.refresh();
          setTick((n) => n + 1);
        }}
        className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/5"
        title={`Refreshes #${tick}`}
      >
        Refresh
      </button>
      <label className="flex items-center gap-1 text-paper/60">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
        />
        Auto every {Math.round(intervalMs / 1000)}s
      </label>
    </div>
  );
}
