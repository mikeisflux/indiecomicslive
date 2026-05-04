"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  status: string;
  amountCents: number;
  hasTransaction: boolean;
};

export default function OrderActions({
  orderId,
  status,
  amountCents,
  hasTransaction,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [partial, setPartial] = useState("");

  async function call(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    const r = await fetch(`/api/admin/orders/${orderId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, reason, ...body }),
    });
    setBusy(null);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        Actions
      </h2>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (audit log)"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {status === "pending_payment" && (
          <button
            onClick={() => call("retry_charge")}
            disabled={busy !== null}
            className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 disabled:opacity-50"
          >
            {busy === "retry_charge" ? "Charging…" : "Retry charge"}
          </button>
        )}
        {hasTransaction && status !== "refunded" && (
          <>
            <button
              onClick={() => call("refund_full")}
              disabled={busy !== null}
              className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-amber-200 disabled:opacity-50"
            >
              {busy === "refund_full"
                ? "Refunding…"
                : `Refund ${(amountCents / 100).toFixed(2)}`}
            </button>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={(amountCents / 100).toFixed(2)}
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              placeholder="$ partial"
              className="w-24 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs"
            />
            <button
              onClick={() =>
                call("refund_partial", {
                  amountCents: Math.round(Number(partial) * 100),
                })
              }
              disabled={busy !== null || !partial}
              className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-amber-200 disabled:opacity-50"
            >
              Partial refund
            </button>
            <button
              onClick={() => call("void")}
              disabled={busy !== null}
              className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-red-300 disabled:opacity-50"
            >
              Void
            </button>
          </>
        )}
        {(status === "paid" || status === "shipped") && (
          <button
            onClick={() => call("mark_shipped")}
            disabled={busy !== null}
            className="rounded-full border border-white/10 px-3 py-1.5 disabled:opacity-50"
          >
            Mark shipped
          </button>
        )}
        {status === "shipped" && (
          <button
            onClick={() => call("mark_delivered")}
            disabled={busy !== null}
            className="rounded-full border border-white/10 px-3 py-1.5 disabled:opacity-50"
          >
            Mark delivered
          </button>
        )}
        {status !== "cancelled" && status !== "refunded" && (
          <button
            onClick={() => call("cancel")}
            disabled={busy !== null}
            className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-red-300 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </section>
  );
}
