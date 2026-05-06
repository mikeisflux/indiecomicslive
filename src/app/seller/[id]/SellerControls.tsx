"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import LotManager from "./LotManager";
import PinControl from "./PinControl";
import ObsCredentials from "@/components/ObsCredentials";

const AntMediaPublisher = dynamic(
  () => import("@/components/AntMediaPublisher"),
  { ssr: false },
);

export type Lot = {
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

type Tab =
  | "stream"
  | "lots"
  | "pinned"
  | "orders"
  | "stats"
  | "messages"
  | "settings";

type Props = {
  show: { id: string; status: string; pinnedLotId: string | null };
  initialLots: Lot[];
};

export default function SellerControls({ show, initialLots }: Props) {
  const [tab, setTab] = useState<Tab>("stream");
  const [pinnedLotId, setPinnedLotId] = useState<string | null>(show.pinnedLotId);

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "stream", label: "Stream" },
    { id: "lots", label: "Lots", badge: String(initialLots.length) },
    {
      id: "pinned",
      label: "Pinned",
      badge: pinnedLotId ? "•" : undefined,
    },
    { id: "orders", label: "Orders" },
    { id: "stats", label: "Stats" },
    { id: "messages", label: "Messages" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 ${
                active
                  ? "bg-accent text-white"
                  : "border border-white/10 text-paper/80 hover:border-white/20"
              }`}
            >
              {t.label}
              {t.badge && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/20" : "bg-white/10 text-paper/70"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "stream" && (
        <section className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
              Browser broadcast
            </h3>
            <p className="text-xs text-paper/50">
              One-click WebRTC broadcast. Allow camera + mic when prompted.
              Sub-second latency.
            </p>
            <AntMediaPublisher showId={show.id} />
          </div>
          <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-paper/60">
              Stream from OBS / external encoder
            </summary>
            <div className="mt-3">
              <ObsCredentials showId={show.id} />
            </div>
          </details>
        </section>
      )}

      {tab === "lots" && (
        <LotManager
          showId={show.id}
          initialLots={initialLots}
          pinnedLotId={pinnedLotId}
          onPinChange={setPinnedLotId}
        />
      )}

      {tab === "pinned" && (
        <PinControl
          showId={show.id}
          lots={initialLots}
          pinnedLotId={pinnedLotId}
          onChange={setPinnedLotId}
        />
      )}

      {tab === "orders" && (
        <Stub
          title="Orders"
          body="See paid orders, print labels, and mark shipments."
          actions={[
            { href: "/seller/orders", label: "Open orders dashboard →" },
            { href: "/seller/ship-from", label: "Set return address" },
          ]}
        />
      )}

      {tab === "stats" && (
        <Stub
          title="Stats"
          body="Weekly aggregates: gross, fees, payouts, top lots. Coming soon."
        />
      )}

      {tab === "messages" && (
        <Stub
          title="Messages"
          body="Buyer ↔ seller direct messages live here. Coming soon."
        />
      )}

      {tab === "settings" && (
        <Stub
          title="Show settings"
          body="Edit show title, description, and cover image."
          actions={[
            { href: "/seller", label: "Back to all shows" },
            { href: "/seller/ship-from", label: "Return address" },
          ]}
        />
      )}
    </div>
  );
}

function Stub({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: { href: string; label: string }[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-paper/60">{body}</p>
      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold hover:border-white/30"
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
