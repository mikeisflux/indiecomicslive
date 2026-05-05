"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  applicationId: string;
  fromProcessor: "nmi" | "divinitycoin";
  toProcessor: "nmi" | "divinitycoin";
};

const friendly = (p: "nmi" | "divinitycoin") =>
  p === "divinitycoin" ? "Divinity Payments" : "PaymentCloud";

export default function MigrateProcessorButton({
  applicationId,
  fromProcessor,
  toProcessor,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  async function migrate() {
    if (
      !confirm(
        `Drop the existing ${friendly(fromProcessor)} chargeback card and ` +
          `ask the seller to re-add one on ${friendly(toProcessor)}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch(
      `/api/admin/seller-applications/${applicationId}/migrate-processor`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notify }),
      },
    );
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(`Failed: ${data.error ?? "unknown"}`);
      return;
    }
    setMsg(
      data.notified
        ? `Cleared. Seller emailed about re-adding the card on ${friendly(toProcessor)}.`
        : `Cleared. Tell the seller to revisit /seller/apply step 4.`,
    );
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
      <p className="font-semibold text-amber-300">
        Processor mismatch
      </p>
      <p className="mt-1 text-amber-200/80">
        This seller&rsquo;s chargeback card is on{" "}
        <strong>{friendly(fromProcessor)}</strong> but the platform&rsquo;s
        active processor is <strong>{friendly(toProcessor)}</strong>. PCI
        rules forbid moving vaulted cards between processors — instead we
        clear the old row so the seller can collect a new card on
        {" "}{friendly(toProcessor)} via /seller/apply step 4.
      </p>
      <label className="mt-2 flex items-center gap-2 text-amber-200/80">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        Email the seller a re-collect link
      </label>
      {msg && <p className="mt-2 text-paper/80">{msg}</p>}
      <button
        onClick={migrate}
        disabled={busy}
        className="mt-2 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-50"
      >
        {busy ? "Clearing…" : `Migrate to ${friendly(toProcessor)}`}
      </button>
    </div>
  );
}
