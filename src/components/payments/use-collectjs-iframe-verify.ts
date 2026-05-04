"use client";

import { useEffect, useRef, useState } from "react";

// Verifier for any component that hosts a CollectJS inline card form.
// After scriptReady flips true and the caller has called
// CollectJS.configure(...), this hook waits 1.5s and checks whether
// an <iframe> attached to the ccnumber placeholder div.
//
// Why: when window.CollectJS persists from a prior SPA-route mount
// (different payment forms across the app), the next configure() call
// sometimes silently fails to attach iframes to new selectors — the
// user sees the form chrome but no card-number input.
//
// On first failed attach: tear down `<script#nmi-collectjs>` +
// window.CollectJS and reset scriptReady=false. The caller's
// script-loader effect re-runs and forces a fresh init.
//
// On second failed attach: set loadFailed=true so the caller can
// render a user-visible error ("Card form failed to load. Please
// refresh the page or contact support."). This catches genuine
// failures (CSP blocking, network, browser iframe sandbox quirks)
// instead of leaving the user with an empty bordered box.
export function useCollectJsIframeVerify({
  scriptReady,
  ccnumberId,
  setScriptReady,
}: {
  scriptReady: boolean;
  ccnumberId: string;
  setScriptReady: (v: boolean) => void;
}): { loadFailed: boolean; resetFailure: () => void } {
  const [loadFailed, setLoadFailed] = useState(false);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    if (!scriptReady) return;
    const verifyTimer = setTimeout(() => {
      const ccDiv = document.getElementById(ccnumberId);
      if (!ccDiv) return;
      if (ccDiv.querySelector("iframe")) {
        attemptCountRef.current = 0;
        setLoadFailed(false);
        return;
      }
      if (attemptCountRef.current >= 1) {
        setLoadFailed(true);
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>(
        "script#nmi-collectjs",
      );
      if (existing) existing.remove();
      (window as unknown as { CollectJS?: unknown }).CollectJS = undefined;
      attemptCountRef.current += 1;
      setScriptReady(false);
    }, 1500);
    return () => clearTimeout(verifyTimer);
  }, [scriptReady, ccnumberId, setScriptReady]);

  return {
    loadFailed,
    resetFailure: () => {
      attemptCountRef.current = 0;
      setLoadFailed(false);
    },
  };
}
