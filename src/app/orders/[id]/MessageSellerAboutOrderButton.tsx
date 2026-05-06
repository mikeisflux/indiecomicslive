"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Opens (or creates) a DM thread with the seller, prefilled with a
// short context line referencing this order so the seller knows
// which lot the buyer is asking about. Uses the existing
// /api/messages POST → /account/messages/[conversationId] flow.
export default function MessageSellerAboutOrderButton({
  recipientId,
  orderId,
  lotTitle,
}: {
  recipientId: string;
  orderId: string;
  lotTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const opener = `Hi! Question about my order: ${lotTitle} (#${orderId.slice(0, 8)})`;
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientId, body: opener }),
    });
    setBusy(false);
    if (r.status === 401) {
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Could not open thread");
      return;
    }
    router.push(`/account/messages/${data.conversationId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold hover:border-white/30 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Message seller"}
      </button>
      {err && <span className="text-xs text-red-300">{err}</span>}
    </>
  );
}
