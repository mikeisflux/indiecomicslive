"use client";

import { useEffect, useRef, useState } from "react";
import type { WebRTCAdaptorCtor } from "@/types/antmedia";

type Status = "idle" | "connecting" | "live" | "error";

// Phone-first publisher. Full-viewport camera preview + a single
// circular Go-Live tap target. Lets the seller swap front/back
// cameras and shows live elapsed time once the broadcast has
// connected.
export default function MobileGoLive({ showId }: { showId: string }) {
  const adaptorRef = useRef<InstanceType<WebRTCAdaptorCtor> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => {
      const ms = Date.now() - startedAt;
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setElapsed(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
      );
    }, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  async function go() {
    setStatus("connecting");
    setError(null);
    try {
      const r = await fetch(`/api/shows/${showId}/publish-token`);
      if (!r.ok) {
        setError("Could not start a stream. Try again.");
        setStatus("error");
        return;
      }
      const { webSocketUrl, streamId, publishToken } = (await r.json()) as {
        webSocketUrl: string;
        streamId: string;
        publishToken: string;
      };

      const scriptOrigin = new URL(
        webSocketUrl.replace("wss://", "https://"),
      ).origin;
      const adaptorScriptUrl = `${scriptOrigin}/${process.env.NEXT_PUBLIC_ANT_MEDIA_APP ?? "WebRTCAppEE"}/js/webrtc_adaptor.js`;
      await loadScript(adaptorScriptUrl);

      const Ctor = window.WebRTCAdaptor;
      if (!Ctor) {
        setError("Publisher SDK failed to load");
        setStatus("error");
        return;
      }

      adaptorRef.current = new Ctor({
        websocket_url: webSocketUrl,
        mediaConstraints: {
          video: { facingMode: { ideal: facing }, width: { ideal: 1080 } },
          audio: true,
        },
        peerconnection_config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
        sdp_constraints: {
          OfferToReceiveAudio: false,
          OfferToReceiveVideo: false,
        },
        localVideoId: `local-video-${showId}`,
        isPlayMode: false,
        debug: false,
        callback: (info) => {
          if (info === "initialized") {
            adaptorRef.current?.publish?.(streamId, publishToken);
          } else if (info === "publish_started") {
            setStatus("live");
            setStartedAt(Date.now());
          } else if (info === "publish_finished") {
            setStatus("idle");
            setStartedAt(null);
          }
        },
        callbackError: (info) => {
          setError(typeof info === "string" ? info : "Publish error");
          setStatus("error");
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
      setStatus("error");
    }
  }

  function stop() {
    try {
      adaptorRef.current?.stop(showId);
    } catch {
      /* swallow */
    }
    setStatus("idle");
    setStartedAt(null);
  }

  function flipCamera() {
    setFacing((f) => (f === "user" ? "environment" : "user"));
    // The simplest way to actually swap the device is to restart the
    // publish flow. Stop + go again.
    if (status === "live") {
      stop();
      // Defer slightly so the WS adaptor unwinds cleanly.
      setTimeout(() => {
        go();
      }, 300);
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          id={`local-video-${showId}`}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {status === "live" && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-white shadow-[0_0_18px_rgba(255,51,102,0.7)]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Live · {elapsed}
          </div>
        )}

        {status === "idle" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
            <p className="rounded-full bg-black/60 px-4 py-2 text-xs uppercase tracking-widest text-paper/80 backdrop-blur">
              Tap below to start streaming
            </p>
          </div>
        )}

        {error && (
          <p className="pointer-events-none absolute inset-x-4 bottom-32 rounded-xl border border-red-400/40 bg-red-500/15 p-3 text-center text-xs text-red-200 backdrop-blur">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-around bg-black/90 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <button
          onClick={flipCamera}
          className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-xl text-paper backdrop-blur active:scale-95"
          aria-label="Switch camera"
        >
          ⇅
        </button>

        {status === "live" ? (
          <button
            onClick={stop}
            className="grid h-20 w-20 place-items-center rounded-full bg-white text-ink shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95"
            aria-label="End stream"
          >
            <span className="h-7 w-7 rounded-md bg-accent" />
          </button>
        ) : (
          <button
            onClick={go}
            disabled={status === "connecting"}
            className="grid h-20 w-20 place-items-center rounded-full bg-accent text-white shadow-[0_0_36px_rgba(255,51,102,0.7)] active:scale-95 disabled:opacity-60"
            aria-label="Go live"
          >
            <span className="h-14 w-14 rounded-full border-4 border-white/90" />
          </button>
        )}

        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[10px] uppercase tracking-widest text-paper/60">
          {facing === "user" ? "Front" : "Back"}
        </span>
      </div>
    </div>
  );
}

const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
  scriptCache.set(src, p);
  return p;
}
