"use client";

import { useEffect, useState } from "react";

type AntMediaProbe = {
  ok: boolean;
  reachable: boolean;
  authOk: boolean;
  versionName?: string;
  versionType?: string;
  latencyMs?: number;
  error?: string;
};

type TurnProbe = {
  ok: boolean;
  configured: boolean;
  hostResolved: boolean;
  credentialFormatOk: boolean;
  error?: string;
};

type WebhookProbe =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; configured: false };

type Health = {
  checkedAt: string;
  antMedia: AntMediaProbe;
  turn: TurnProbe;
  webhookSelfCheck: WebhookProbe;
};

export default function StreamingHealthPanel() {
  const [data, setData] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/health/streaming", {
        cache: "no-store",
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
          Streaming health
        </h2>
        <div className="flex items-center gap-3 text-xs text-paper/50">
          {data && (
            <span>
              Checked {new Date(data.checkedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={busy}
            className="rounded-full border border-white/10 px-3 py-1 disabled:opacity-50"
          >
            {busy ? "Probing…" : "Re-probe"}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!data ? (
        <p className="text-sm text-paper/50">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card
            title="Ant Media"
            tone={
              data.antMedia.ok
                ? "good"
                : data.antMedia.reachable
                  ? "warn"
                  : "bad"
            }
            primary={
              data.antMedia.ok
                ? `${data.antMedia.versionName ?? "OK"} · ${data.antMedia.latencyMs ?? "?"}ms`
                : data.antMedia.reachable
                  ? "Reachable, auth failed"
                  : "Unreachable"
            }
            details={
              data.antMedia.ok
                ? `${data.antMedia.versionType ?? ""} ${data.antMedia.versionName ?? ""}`
                : (data.antMedia.error ?? "")
            }
          />
          <Card
            title="TURN"
            tone={
              data.turn.ok ? "good" : data.turn.configured ? "warn" : "bad"
            }
            primary={
              !data.turn.configured
                ? "Not configured"
                : data.turn.ok
                  ? "OK"
                  : "Misconfigured"
            }
            details={
              data.turn.ok
                ? "DNS resolves · credential format good"
                : (data.turn.error ?? "")
            }
          />
          <Card
            title="Webhook signing"
            tone={
              data.webhookSelfCheck.ok
                ? "good"
                : "configured" in data.webhookSelfCheck &&
                    data.webhookSelfCheck.configured === false
                  ? "bad"
                  : "warn"
            }
            primary={
              data.webhookSelfCheck.ok
                ? "OK"
                : "configured" in data.webhookSelfCheck &&
                    data.webhookSelfCheck.configured === false
                  ? "Not configured"
                  : "HMAC mismatch"
            }
            details={
              data.webhookSelfCheck.ok
                ? "Sign+verify round-trip passes"
                : "error" in data.webhookSelfCheck
                  ? data.webhookSelfCheck.error
                  : "ANT_MEDIA_WEBHOOK_SECRET unset"
            }
          />
        </div>
      )}
    </section>
  );
}

function Card({
  title,
  tone,
  primary,
  details,
}: {
  title: string;
  tone: "good" | "warn" | "bad";
  primary: string;
  details: string;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-red-500/40 bg-red-500/5";
  const dot =
    tone === "good"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : "bg-red-400";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-paper/60">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </div>
      <p className="mt-2 text-lg font-bold">{primary}</p>
      {details && <p className="mt-1 text-xs text-paper/60">{details}</p>}
    </div>
  );
}
