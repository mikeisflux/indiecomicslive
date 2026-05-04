"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnblockButton({ ip }: { ip: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unblock() {
    if (!confirm(`Unblock ${ip}? This removes the row + iptables rule.`)) return;
    setBusy(true);
    const r = await fetch(
      `/api/admin/bot-block/${encodeURIComponent(ip)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <button
      onClick={unblock}
      disabled={busy}
      className="rounded-full border border-white/10 px-3 py-1 text-xs disabled:opacity-50"
    >
      {busy ? "…" : "Unblock"}
    </button>
  );
}
