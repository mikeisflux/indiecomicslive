"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LotManager from "./LotManager";

const AntMediaPublisher = dynamic(
  () => import("@/components/AntMediaPublisher"),
  { ssr: false },
);

type Lot = {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  startingBidCents: number;
  minIncrementCents: number;
  status: string;
  currentBidCents: number | null;
  bidCount: number;
};

type Props = {
  show: { id: string; status: string };
  initialLots: Lot[];
};

export default function SellerControls({ show, initialLots }: Props) {
  const [tab, setTab] = useState<"broadcast" | "lots">("broadcast");

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 text-sm">
        <button
          onClick={() => setTab("broadcast")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "broadcast" ? "bg-accent text-white" : "border border-white/10"
          }`}
        >
          Broadcast
        </button>
        <button
          onClick={() => setTab("lots")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "lots" ? "bg-accent text-white" : "border border-white/10"
          }`}
        >
          Lots ({initialLots.length})
        </button>
      </nav>

      {tab === "broadcast" && <AntMediaPublisher showId={show.id} />}
      {tab === "lots" && (
        <LotManager showId={show.id} initialLots={initialLots} />
      )}
    </div>
  );
}
