"use client";

import { useEffect, useState } from "react";

type Publish = {
  rtmpServerUrl: string;
  rtmpStreamKey: string;
  rtmpFullUrl: string;
  streamId: string;
  publishTokenExpSec: number;
};

// "Stream from OBS" panel for the seller's broadcast tab. Fetches a
// fresh RTMP URL + stream key from /api/shows/[id]/publish-token on
// mount so JWT expiry doesn't bite mid-stream. Includes a Rotate button
// that re-issues the token (useful if you suspect leakage).
export default function ObsCredentials({ showId }: { showId: string }) {
  const [pub, setPub] = useState<Publish | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTokens() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/shows/${showId}/publish-token`);
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error ?? "Could not load credentials");
        return;
      }
      setPub(await r.json());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetchTokens();
  }, [showId]);

  if (!pub) {
    return (
      <p className="text-sm text-paper/60">
        {error ?? (busy ? "Loading OBS credentials…" : "Loading…")}
      </p>
    );
  }

  const expiresAt = new Date(pub.publishTokenExpSec * 1000);
  const expired = expiresAt.getTime() < Date.now();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-paper/60">
        Paste these into OBS &rarr; <strong>Settings &rarr; Stream</strong>.
        Set service to <strong>&ldquo;Custom&hellip;&rdquo;</strong>.
      </p>

      <Field label="Server / URL" value={pub.rtmpServerUrl} />
      <Field
        label="Stream Key"
        value={pub.rtmpStreamKey}
        secret
        revealed={revealed}
        onReveal={() => setRevealed(!revealed)}
      />

      <details className="text-xs text-paper/50">
        <summary className="cursor-pointer">
          Some encoders take a single URL
        </summary>
        <div className="mt-2">
          <Field label="Full URL" value={pub.rtmpFullUrl} secret revealed={revealed} />
        </div>
      </details>

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-paper/60">
        <span>
          Token expires{" "}
          <span className={expired ? "text-accent" : ""}>
            {expiresAt.toLocaleString()}
          </span>
        </span>
        <button
          onClick={fetchTokens}
          disabled={busy}
          className="rounded-full border border-white/10 px-3 py-1 disabled:opacity-50"
        >
          {busy ? "Rotating…" : "Rotate"}
        </button>
      </div>

      <details className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-paper/80">
          Recommended OBS settings
        </summary>
        <ul className="mt-2 space-y-1 text-paper/60">
          <li>Output Mode: Advanced</li>
          <li>Encoder: x264 (or hardware H.264 if available)</li>
          <li>Rate Control: CBR</li>
          <li>Bitrate: 4500 Kbps (1080p30) / 2500 Kbps (720p30)</li>
          <li>Keyframe interval: 2s</li>
          <li>Profile: high</li>
          <li>Audio: 160 Kbps AAC stereo, 48 kHz</li>
        </ul>
      </details>
    </div>
  );
}

function Field({
  label,
  value,
  secret,
  revealed,
  onReveal,
}: {
  label: string;
  value: string;
  secret?: boolean;
  revealed?: boolean;
  onReveal?: () => void;
}) {
  const display = secret && !revealed ? value.replace(/./g, "•") : value;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-paper/60">{label}</label>
        <div className="flex gap-2 text-[10px]">
          {secret && onReveal && (
            <button
              onClick={onReveal}
              className="rounded-full border border-white/10 px-2 py-0.5"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
          )}
          <button
            onClick={copy}
            className="rounded-full border border-white/10 px-2 py-0.5"
          >
            Copy
          </button>
        </div>
      </div>
      <input
        readOnly
        value={display}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
