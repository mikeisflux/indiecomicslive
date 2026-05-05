"use client";

import { useEffect, useRef } from "react";

// Drop-in reCAPTCHA v2 ("I'm not a robot") widget. Renders a hidden
// <div> that grecaptcha.render() targets; on success the widget
// auto-populates a hidden form field named "g-recaptcha-response"
// which the parent form will include on submit.
//
// If `siteKey` is null/empty we render nothing — the parent form
// behaves normally and server verification short-circuits.

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        el: HTMLElement,
        opts: { sitekey: string; theme?: "dark" | "light"; callback?: (token: string) => void },
      ) => number;
      reset: (id?: number) => void;
      getResponse: (id?: number) => string;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      // grecaptcha.ready is sometimes not yet defined right after load
      const tick = () => {
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(() => resolve());
        } else {
          setTimeout(tick, 30);
        }
      };
      tick();
    };
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function RecaptchaWidget({
  siteKey,
  theme = "dark",
}: {
  siteKey: string | null | undefined;
  theme?: "dark" | "light";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.grecaptcha) return;
        if (idRef.current !== null) return;
        idRef.current = window.grecaptcha.render(ref.current, {
          sitekey: siteKey,
          theme,
        });
      })
      .catch((e) => {
        console.warn("[recaptcha] widget load failed", e);
      });
    return () => {
      cancelled = true;
    };
  }, [siteKey, theme]);

  if (!siteKey) return null;
  return <div ref={ref} className="my-3" />;
}
