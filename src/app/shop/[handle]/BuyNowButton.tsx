"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Buy-Now button. For pack_break lots, surfaces a quantity stepper so
// buyers can claim N spots in one round-trip. For everything else, a
// single button. The server validates quantity against kind +
// inventory.
export default function BuyNowButton({
  lotId,
  kind,
  inventoryCount,
  spotPriceCents,
}: {
  lotId: string;
  kind?: "auction" | "buy_now" | "mystery" | "pack_break" | "flash";
  inventoryCount?: number;
  spotPriceCents?: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isPack = kind === "pack_break";
  const max = Math.max(1, Math.min(inventoryCount ?? 1, isPack ? 32 : 1));

  async function buy() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/lots/${lotId}/buy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: qty }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) {
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (!r.ok) {
      setErr(data.message || data.error || "Could not complete purchase");
      return;
    }
    if (data.orderIds && data.orderIds.length > 1) {
      router.push(`/orders`);
    } else {
      router.push(`/orders/${data.orderId ?? data.orderIds?.[0]}`);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isPack && (
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setQty((n) => Math.max(1, n - 1))}
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="w-8 text-center font-mono font-bold">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((n) => Math.min(max, n + 1))}
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Increase"
          >
            +
          </button>
          <span className="px-1 text-[10px] text-paper/40">/{max}</span>
        </div>
      )}
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_14px_rgba(255,51,102,0.4)] disabled:opacity-50"
      >
        {busy
          ? "Charging…"
          : isPack
            ? `Claim ${qty} spot${qty === 1 ? "" : "s"}${
                spotPriceCents
                  ? ` · $${((qty * spotPriceCents) / 100).toFixed(2)}`
                  : ""
              }`
            : "Buy now"}
      </button>
      {err && (
        <p className="max-w-[200px] text-right text-[10px] text-red-300">
          {err}
        </p>
      )}
    </div>
  );
}
