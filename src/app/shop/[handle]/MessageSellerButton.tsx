"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lightweight launcher: starts (or finds) a conversation with the
// shop's seller and routes the user into the thread view. Auth is
// required — unauthenticated visitors get bounced to /sign-in.
export default function MessageSellerButton({
  recipientId,
}: {
  recipientId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Send an empty placeholder body? The API requires min(1). Use a
      // friendly opener instead — the user can edit it inside the
      // thread by sending more messages.
      body: JSON.stringify({ recipientId, body: "👋" }),
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
      setErr(data.message || data.error || "Could not start conversation");
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
      {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
    </>
  );
}
