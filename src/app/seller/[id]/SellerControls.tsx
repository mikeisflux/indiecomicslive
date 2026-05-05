"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LotManager from "./LotManager";
import ObsCredentials from "@/components/ObsCredentials";

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
  const [tab, setTab] = useState<"browser" | "obs" | "lots">("browser");

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => setTab("browser")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "browser"
              ? "bg-accent text-white"
              : "border border-white/10"
          }`}
        >
          Browser broadcast
        </button>
        <button
          onClick={() => setTab("obs")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "obs"
              ? "bg-accent text-white"
              : "border border-white/10"
          }`}
        >
          Stream from OBS
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

      {tab === "browser" && (
        <section className="space-y-3">
          <p className="text-xs text-paper/60">
            One-click WebRTC broadcast straight from your browser. Allow
            camera + mic when prompted. Sub-second latency.
          </p>
          <AntMediaPublisher showId={show.id} />
        </section>
      )}

      {tab === "obs" && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
            Stream from OBS / external encoder
          </h3>
          <ObsCredentials showId={show.id} />
        </section>
      )}

      {tab === "lots" && (
        <LotManager showId={show.id} initialLots={initialLots} />
      )}
    </div>
  );
}
