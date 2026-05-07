"use client";

import { useEffect, useRef, useState } from "react";
import type { WebRTCAdaptorCtor } from "@/types/antmedia";

type Props = {
  showId: string;
  poster?: string | null;
  // Optional override — when set, the player fetches play-token for
  // this specific stream id instead of the show's main stream. Used
  // by the multi-cam picker.
  cam?: string | null;
  // Optional list of registered alt cams (3-cam break setup). When
  // present and length > 0 the player renders a small dropdown.
  extraCams?: { id: string; label: string }[];
};

// WebRTC playback for live shows. Loads Ant Media's webrtc_adaptor.js
// from the same host that's serving the stream, since the script is
// part of every Ant Media app deployment. When cam is set, the
// component re-mounts to swap streams.
export default function AntMediaPlayer({
  showId,
  poster,
  cam,
  extraCams,
}: Props) {
  const [picked, setPicked] = useState<string | null>(cam ?? null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let adaptor: InstanceType<WebRTCAdaptorCtor> | null = null;

    async function start() {
      const tokenUrl = picked
        ? `/api/shows/${showId}/play-token?cam=${encodeURIComponent(picked)}`
        : `/api/shows/${showId}/play-token`;
      const [tokenR, iceR] = await Promise.all([
        fetch(tokenUrl),
        fetch(`/api/turn-credentials`),
      ]);
      if (!tokenR.ok) {
        setError("Stream not available");
        return;
      }
      const { webSocketUrl, streamId, playToken } = (await tokenR.json()) as {
        webSocketUrl: string;
        streamId: string;
        playToken: string;
      };
      const { iceServers } = (await iceR.json().catch(() => ({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      }))) as { iceServers: RTCIceServer[] };
      if (cancelled) return;

      const scriptOrigin = new URL(webSocketUrl.replace("wss://", "https://"))
        .origin;
      const adaptorScriptUrl = `${scriptOrigin}/${process.env.NEXT_PUBLIC_ANT_MEDIA_APP ?? "WebRTCAppEE"}/js/webrtc_adaptor.js`;

      await loadScript(adaptorScriptUrl);
      if (cancelled) return;

      const Ctor = window.WebRTCAdaptor;
      if (!Ctor) {
        setError("Player failed to load");
        return;
      }

      adaptor = new Ctor({
        websocket_url: webSocketUrl,
        peerconnection_config: { iceServers },
        sdp_constraints: { OfferToReceiveAudio: true, OfferToReceiveVideo: true },
        remoteVideoId: `remote-video-${streamId}`,
        isPlayMode: true,
        debug: false,
        callback: (info) => {
          if (info === "initialized") {
            adaptor?.play?.(streamId, playToken);
          } else if (info === "play_started") {
            setWaiting(false);
            setError(null);
          } else if (info === "play_finished" || info === "closed") {
            setWaiting(true);
          } else if (info === "no_stream_exists") {
            setError("Not live yet");
          }
        },
        callbackError: (info) => {
          if (info === "no_stream_exists") setError("Not live yet");
        },
      });
    }

    start().catch((e) => setError(e.message ?? "Player error"));

    return () => {
      cancelled = true;
      try {
        adaptor?.stop(showId);
      } catch {}
    };
  }, [showId, picked]);

  const cams = extraCams ?? [];

  return (
    <div className="relative h-full w-full bg-black">
      <video
        id={`remote-video-${showId}`}
        ref={videoRef}
        autoPlay
        playsInline
        muted
        poster={poster ?? undefined}
        className="h-full w-full object-cover"
      />
      {cams.length > 0 && (
        <div className="absolute right-3 top-3 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setPicked(null)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur ${
              picked === null
                ? "bg-accent text-white"
                : "bg-black/60 text-paper/80 hover:bg-black/80"
            }`}
          >
            Main
          </button>
          {cams.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPicked(c.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur ${
                picked === c.id
                  ? "bg-accent text-white"
                  : "bg-black/60 text-paper/80 hover:bg-black/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {(waiting || error) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-paper/60">
          {error ?? "Connecting…"}
        </div>
      )}
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
