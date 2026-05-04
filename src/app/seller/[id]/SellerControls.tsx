"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const AntMediaPublisher = dynamic(
  () => import("@/components/AntMediaPublisher"),
  { ssr: false },
);

type Props = { show: { id: string; status: string } };

export default function SellerControls({ show }: Props) {
  const [tab, setTab] = useState<"broadcast" | "lots">("broadcast");

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 text-sm">
        <button
          onClick={() => setTab("broadcast")}
          className={`rounded-full px-4 py-1.5 ${tab === "broadcast" ? "bg-accent text-white" : "border border-white/10"}`}
        >
          Broadcast
        </button>
        <button
          onClick={() => setTab("lots")}
          className={`rounded-full px-4 py-1.5 ${tab === "lots" ? "bg-accent text-white" : "border border-white/10"}`}
        >
          Lots
        </button>
      </nav>

      {tab === "broadcast" && <AntMediaPublisher showId={show.id} />}
      {tab === "lots" && (
        <p className="text-sm text-paper/60">
          Lot management UI not built yet. POST to /api/lots and
          /api/lots/start to drive the auction.
        </p>
      )}
    </div>
  );
}
