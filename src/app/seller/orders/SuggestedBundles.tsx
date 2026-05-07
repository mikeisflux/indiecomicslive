"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Group {
  buyer: { id: string; name: string | null; handle: string | null };
  orders: { id: string; title: string; amountCents: number }[];
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Surfaced at the top of /seller/orders when the seller has 2+ paid,
// unshipped, unbundled orders from the same buyer in the last 7d.
// One-tap bundle creates a single Shipment so the seller prints one
// label instead of N — the buyer pays for one box, not three.
export default function SuggestedBundles({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function bundle(group: Group) {
    setBusy(group.buyer.id);
    setErr(null);
    try {
      const r = await fetch("/api/seller/shipments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderIds: group.orders.map((o) => o.id),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || j.error || "Could not bundle.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const visible = groups.filter((g) => !dismissed.has(g.buyer.id));
  if (visible.length === 0) return null;

  return (
    <section className="mb-5 space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-paper/60">
        <span aria-hidden>📦</span>
        Suggested bundles · last 7 days
      </h2>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {visible.map((g) => {
        const total = g.orders.reduce((a, o) => a + o.amountCents, 0);
        const buyerLabel =
          g.buyer.name ?? (g.buyer.handle ? `@${g.buyer.handle}` : "buyer");
        return (
          <div
            key={g.buyer.id}
            className="icl-glass-accent flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-paper">
                {g.orders.length} orders for{" "}
                <span className="text-accent">{buyerLabel}</span> · total{" "}
                <span className="font-mono">{dollars(total)}</span>
              </p>
              <p className="line-clamp-1 text-xs text-paper/70">
                {g.orders.map((o) => o.title).join(" · ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setDismissed((d) => {
                    const next = new Set(d);
                    next.add(g.buyer.id);
                    return next;
                  })
                }
                className="rounded-full border border-white/15 px-3 py-1 text-xs"
              >
                Dismiss
              </button>
              <button
                onClick={() => bundle(g)}
                disabled={busy === g.buyer.id}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
              >
                {busy === g.buyer.id
                  ? "Bundling…"
                  : `Bundle ${g.orders.length}`}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
