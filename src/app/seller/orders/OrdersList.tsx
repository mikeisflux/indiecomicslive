"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface SellerOrderRow {
  id: string;
  amountCents: number;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  shipmentId: string | null;
  paidAt: string | null;
  buyer: { id: string; name: string | null; handle: string | null; email: string | null };
  lot: { title: string | null };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(o: SellerOrderRow): { label: string; tone: string } {
  if (o.deliveredAt) return { label: "Delivered", tone: "bg-emerald-500/20 text-emerald-300" };
  if (o.shippedAt) return { label: "Shipped", tone: "bg-sky-500/20 text-sky-300" };
  if (o.shipmentId) return { label: "Bundled", tone: "bg-purple-500/20 text-purple-300" };
  if (o.status === "paid") return { label: "Awaiting label", tone: "bg-amber-500/20 text-amber-300" };
  if (o.status === "refunded") return { label: "Refunded", tone: "bg-paper/10 text-paper/60" };
  if (o.status === "cancelled") return { label: "Cancelled", tone: "bg-paper/10 text-paper/60" };
  return { label: o.status, tone: "bg-white/10 text-paper/70" };
}

export default function OrdersList({ orders }: { orders: SellerOrderRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bundling, setBundling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Eligibility: paid + not shipped + not yet bundled
  const eligible = (o: SellerOrderRow) =>
    o.status === "paid" && !o.shippedAt && !o.shipmentId;

  function toggle(id: string) {
    const o = orders.find((x) => x.id === id);
    if (!o || !eligible(o)) return;
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    setErr(null);
  }

  // Validate: same buyer across all selected.
  const sharedBuyerId = useMemo(() => {
    if (selected.size < 2) return null;
    const picks = orders.filter((o) => selected.has(o.id));
    const buyers = new Set(picks.map((p) => p.buyer.id));
    if (buyers.size !== 1) return null;
    return picks[0].buyer.id;
  }, [selected, orders]);

  const canBundle = selected.size >= 2 && !!sharedBuyerId;

  async function bundle() {
    if (!canBundle) return;
    setBundling(true);
    setErr(null);
    const r = await fetch("/api/seller/shipments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected) }),
    });
    setBundling(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Bundle failed");
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
          <span>
            {selected.size} selected
            {selected.size >= 2 && !sharedBuyerId && (
              <span className="ml-2 text-amber-300">
                — different buyers; bundling requires same buyer
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full border border-white/15 px-3 py-1 text-xs"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={bundle}
              disabled={!canBundle || bundling}
              className="rounded-full bg-accent px-4 py-1 text-xs font-bold text-white disabled:opacity-40"
            >
              {bundling ? "Bundling…" : `Bundle ${selected.size} orders`}
            </button>
          </div>
        </div>
      )}
      {err && <p className="mb-3 text-sm text-red-300">{err}</p>}

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          No paid orders yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {orders.map((o) => {
            const b = statusBadge(o);
            const canSelect = eligible(o);
            const isSelected = selected.has(o.id);
            return (
              <li key={o.id}>
                <div className="flex items-center gap-3 px-5 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!canSelect}
                    onChange={() => toggle(o.id)}
                    aria-label={`Select order ${o.id.slice(0, 8)}`}
                    className="shrink-0"
                  />
                  <Link
                    href={`/seller/orders/${o.id}`}
                    className="block min-w-0 flex-1 hover:bg-white/[0.04]"
                  >
                    <p className="truncate font-semibold">
                      {o.lot.title || "(untitled lot)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-paper/50">
                      {dollars(o.amountCents)} ·{" "}
                      {o.buyer.name ?? o.buyer.handle ?? o.buyer.email}
                      {o.trackingNumber ? ` · ${o.trackingNumber}` : ""}
                    </p>
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${b.tone}`}
                  >
                    {b.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
