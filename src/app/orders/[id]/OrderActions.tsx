"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { orderId: string; status: string };

export default function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending_payment") return null;

  async function retry() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/orders/${orderId}/charge`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(data.error ?? "Charge failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-paper/60">
        Auto-charge didn&rsquo;t go through. Make sure your saved card is
        valid, then retry.
      </p>
      <div className="flex gap-2">
        <button
          onClick={retry}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Charging…" : "Retry payment"}
        </button>
        <a
          href="/account/payment-method"
          className="rounded-full border border-white/10 px-4 py-2 text-sm"
        >
          Update card
        </a>
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
