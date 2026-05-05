"use client";

import { useEffect, useRef, useState } from "react";
import type { WebRTCAdaptorCtor } from "@/types/antmedia";

type Props = {
  showId: string;
};

// Browser-based WebRTC broadcaster for sellers. No OBS required.
// Falls back gracefully if mic/camera permission is denied — the
// seller can still use OBS via the RTMP URL shown in their dashboard.
export default function AntMediaPublisher({ showId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adaptorRef = useRef<InstanceType<WebRTCAdaptorCtor> | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setStatus("connecting");
    setError(null);

    const r = await fetch(`/api/shows/${showId}/publish-token`);
    if (!r.ok) {
      setError("Could not get publish token");
      setStatus("error");
      return;
    }
    const { webSocketUrl, streamId, publishToken } = (await r.json()) as {
      webSocketUrl: string;
      streamId: string;
      publishToken: string;
    };

    const scriptOrigin = new URL(webSocketUrl.replace("wss://", "https://")).origin;
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
      mediaConstraints: { video: true, audio: true },
      peerconnection_config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
      sdp_constraints: { OfferToReceiveAudio: false, OfferToReceiveVideo: false },
      localVideoId: `local-video-${showId}`,
      isPlayMode: false,
      debug: false,
      callback: (info) => {
        if (info === "initialized") {
          adaptorRef.current?.publish(streamId, publishToken);
        } else if (info === "publish_started") {
          setStatus("live");
        } else if (info === "publish_finished") {
          setStatus("idle");
        }
      },
      callbackError: (info) => {
        setError(typeof info === "string" ? info : "Publish error");
        setStatus("error");
      },
    });
  }

  function stop() {
    try {
      adaptorRef.current?.stop(showId);
    } catch {}
    setStatus("idle");
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <video
          id={`local-video-${showId}`}
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {status === "live" && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase">
            Live
          </span>
        )}
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex gap-2">
        {status === "live" ? (
          <button
            onClick={stop}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold"
          >
            End stream
          </button>
        ) : (
          <button
            onClick={go}
            disabled={status === "connecting"}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting…" : "Go live"}
          </button>
        )}
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
