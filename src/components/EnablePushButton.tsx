"use client";

import { useEffect, useState } from "react";

// Subscribes the current device to Web Push. Three states:
//   - "unsupported" → browser can't do push or notifications
//   - "needs-grant" → permission default/denied or no subscription
//   - "subscribed"  → push is on, button switches to "Disable"
export default function EnablePushButton() {
  const [state, setState] = useState<
    "loading" | "unsupported" | "needs-grant" | "subscribed"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(
          sub && Notification.permission === "granted"
            ? "subscribed"
            : "needs-grant",
        );
      } catch {
        setState("needs-grant");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setErr("Notifications blocked. Allow in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        setErr("Push isn't configured on the server yet.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapid),
      });
      const json = sub.toJSON();
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          authKey: json.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      });
      if (!r.ok) {
        setErr("Could not save the subscription.");
        return;
      }
      setState("subscribed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("needs-grant");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <button
        className="rounded-full border border-white/10 px-4 py-2 text-xs text-paper/40"
        disabled
      >
        Checking…
      </button>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="text-xs text-paper/40">
        Push notifications aren&rsquo;t supported on this device.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {state === "subscribed" ? (
        <button
          onClick={disable}
          disabled={busy}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-paper/80 hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
        >
          {busy ? "…" : "Disable notifications"}
        </button>
      ) : (
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
        >
          {busy ? "…" : "Enable notifications"}
        </button>
      )}
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  );
}

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
