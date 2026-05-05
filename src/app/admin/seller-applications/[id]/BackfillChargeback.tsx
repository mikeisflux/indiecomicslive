"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BackfillChargeback({
  applicationId,
  buyerCard,
}: {
  applicationId: string;
  buyerCard: { brand: string | null; lastFour: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function backfill() {
    setBusy(true);
    setError(null);
    const r = await fetch(
      `/api/admin/seller-applications/${applicationId}/backfill-chargeback`,
      { method: "POST" },
    );
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Backfill failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
      <p className="font-semibold text-amber-300">
        Misrouted card detected
      </p>
      <p className="mt-1 text-amber-200/80">
        This seller has a {buyerCard.brand ?? "card"} ••••{buyerCard.lastFour}{" "}
        in the buyer-card table from before the chargeback flow was fixed.
        Click below to move it to the chargeback table so the application
        can be approved.
      </p>
      {error && <p className="mt-2 text-red-300">{error}</p>}
      <button
        onClick={backfill}
        disabled={busy}
        className="mt-2 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-50"
      >
        {busy ? "Moving…" : "Use this card as chargeback card on file"}
      </button>
    </div>
  );
}
