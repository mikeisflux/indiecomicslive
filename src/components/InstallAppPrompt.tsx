"use client";

import { useEffect, useState } from "react";

// Cross-platform Add-to-Home-Screen nudge.
//
//  - Android / Chromium-on-desktop: listens for `beforeinstallprompt`
//    and surfaces an "Install app" pill that triggers the native
//    install dialog when tapped.
//  - iOS Safari: doesn't fire the event, but it's the platform with
//    the biggest install benefit. We sniff the UA and surface a
//    one-shot toast with the share-sheet → "Add to Home Screen"
//    instruction.
//
// We only show this once per device. The user's "Not now" / "Got it"
// dismissal is sticky in localStorage; install detection
// (display-mode: standalone) hides it forever.
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KEY = "icl-install-dismissed-v1";

export default function InstallAppPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [iosNudge, setIosNudge] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY) === "1") return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    // iOS Safari has window.navigator.standalone === true when
    // launched from the home screen; same kill-switch.
    if (
      "standalone" in window.navigator &&
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari sniff — show the manual instruction once.
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isIos && isSafari) {
      setIosNudge(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* swallow */
    }
    setBip(null);
    setIosNudge(false);
  }

  async function install() {
    if (!bip) return;
    try {
      await bip.prompt();
      await bip.userChoice;
    } catch {
      /* swallow */
    }
    dismiss();
  }

  if (!bip && !iosNudge) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-black/85 p-3 text-sm text-paper backdrop-blur-md shadow-2xl md:bottom-3"
      role="status"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          className="h-5 w-5"
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">Install Indie Comics Live</p>
        <p className="text-xs text-paper/70">
          {bip
            ? "Add to your home screen for native-app feel — no app store."
            : "Tap the share button, then “Add to Home Screen”."}
        </p>
      </div>
      {bip ? (
        <button
          onClick={install}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_14px_rgba(255,51,102,0.5)]"
        >
          Install
        </button>
      ) : (
        <button
          onClick={dismiss}
          className="rounded-full border border-white/15 px-3 py-1 text-xs"
        >
          Got it
        </button>
      )}
      {bip && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-paper/50 hover:text-paper"
        >
          ✕
        </button>
      )}
    </div>
  );
}
