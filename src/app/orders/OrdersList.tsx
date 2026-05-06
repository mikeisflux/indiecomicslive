"use client";

import Link from "next/link";
import { useState } from "react";

export interface OrderRow {
  id: string;
  title: string;
  imageUrl: string | null;
  kind: "auction" | "buy_now" | "mystery";
  amountCents: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  trackingUrl: string | null;
  sellerHandle: string | null;
  sellerName: string | null;
}

type Tab = "all" | "in_flight" | "delivered" | "refunded";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_flight", label: "In-flight" },
  { id: "delivered", label: "Delivered" },
  { id: "refunded", label: "Refunded" },
];

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusInfo(o: OrderRow): { label: string; tone: string } {
  if (o.status === "refunded") {
    return { label: "Refunded", tone: "bg-paper/10 text-paper/60" };
  }
  if (o.status === "cancelled") {
    return { label: "Cancelled", tone: "bg-paper/10 text-paper/60" };
  }
  if (o.deliveredAt) {
    return { label: "Delivered", tone: "bg-emerald-500/20 text-emerald-300" };
  }
  if (o.shippedAt) {
    return { label: "Shipped", tone: "bg-sky-500/20 text-sky-300" };
  }
  if (o.status === "paid") {
    return { label: "Paid · awaiting ship", tone: "bg-amber-500/20 text-amber-300" };
  }
  if (o.status === "payment_failed") {
    return { label: "Payment failed", tone: "bg-red-500/20 text-red-300" };
  }
  if (o.status === "pending_payment") {
    return { label: "Pending payment", tone: "bg-paper/10 text-paper/70" };
  }
  return { label: o.status, tone: "bg-white/10 text-paper/70" };
}

function counts(orders: OrderRow[]) {
  return {
    all: orders.length,
    in_flight: orders.filter(
      (o) =>
        !o.deliveredAt &&
        ["paid", "shipped"].includes(o.status),
    ).length,
    delivered: orders.filter((o) => !!o.deliveredAt).length,
    refunded: orders.filter((o) => o.status === "refunded").length,
  };
}

export default function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const c = counts(orders);

  const filtered = orders.filter((o) => {
    if (tab === "all") return true;
    if (tab === "in_flight") {
      return !o.deliveredAt && ["paid", "shipped"].includes(o.status);
    }
    if (tab === "delivered") return !!o.deliveredAt;
    if (tab === "refunded") return o.status === "refunded";
    return true;
  });

  return (
    <>
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 text-xs sm:mx-0 sm:overflow-visible sm:px-0">
        {TAB_LABELS.map((t) => {
          const active = t.id === tab;
          const count = c[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 ${
                active
                  ? "bg-accent text-white"
                  : "border border-white/10 text-paper/80 hover:border-white/20"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/20" : "bg-white/10 text-paper/70"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          {tab === "all" ? (
            <>
              You haven&rsquo;t bought anything yet.{" "}
              <Link href="/" className="text-accent hover:underline">
                Browse live shows.
              </Link>
            </>
          ) : (
            "Nothing in this bucket."
          )}
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {filtered.map((o) => {
            const s = statusInfo(o);
            return (
              <li key={o.id}>
                <div className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:bg-white/[0.04]"
                  >
                    {o.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.imageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-lg bg-white/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {o.title}
                        {o.kind === "mystery" && (
                          <span className="ml-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                            Mystery
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-paper/60">
                        {dollars(o.amountCents)} · @
                        {o.sellerHandle ?? "unknown"}
                      </p>
                      {o.trackingNumber && (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-paper/50">
                          {o.shippingCarrier ?? "ship"} ·{" "}
                          {o.trackingUrl ? (
                            <a
                              href={o.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {o.trackingNumber}
                            </a>
                          ) : (
                            o.trackingNumber
                          )}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.tone}`}
                    >
                      {s.label}
                    </span>
                    <span className="text-[10px] text-paper/40">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
