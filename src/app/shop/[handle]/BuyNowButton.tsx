"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyNowButton({ lotId }: { lotId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/lots/${lotId}/buy`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!r.ok) {
      setErr(data.message || data.error || "Could not complete purchase");
      return;
    }
    router.push(`/orders/${data.orderId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Charging…" : "Buy now"}
      </button>
      {err && (
        <p className="max-w-[160px] text-right text-[10px] text-red-300">{err}</p>
      )}
    </div>
  );
}
