"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  apiKeySet: boolean;
  webhookSecretSet: boolean;
}

export default function ShippingSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const body: Record<string, unknown> = {};
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    if (webhookSecret.trim()) body.webhookSecret = webhookSecret.trim();
    if (Object.keys(body).length === 0) {
      setBusy(false);
      setErr("Nothing to save (leave blank to keep existing).");
      return;
    }
    const r = await fetch("/api/admin/settings/shipping", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    setApiKey("");
    setWebhookSecret("");
    router.refresh();
  }

  async function verify() {
    setBusy(true);
    setVerifyResult(null);
    setErr(null);
    const r = await fetch("/api/admin/settings/shipping/test", {
      method: "POST",
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (data.ok) {
      setVerifyResult(
        `Connected. ${data.carriers ?? 0} carrier${data.carriers === 1 ? "" : "s"} active on this Shippo account.`,
      );
    } else {
      setVerifyResult(
        data.message || data.error || `Failed (HTTP ${data.status})`,
      );
    }
  }

  async function clearKey(field: "apiKey" | "webhookSecret") {
    const label = field === "apiKey" ? "API key" : "webhook secret";
    if (!confirm(`Clear the Shippo ${label}?`)) return;
    setBusy(true);
    const r = await fetch("/api/admin/settings/shipping", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: null }),
    });
    setBusy(false);
    if (r.ok) {
      setMsg(`Cleared ${label}.`);
      router.refresh();
    }
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono";

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Shippo live API token{" "}
          {initial.apiKeySet && (
            <span className="text-emerald-300">— currently set</span>
          )}
        </label>
        <input
          type="password"
          className={inp}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={initial.apiKeySet ? "•••• (leave blank to keep)" : "shippo_live_xxxxxxxxxxxxxxxx"}
          autoComplete="off"
        />
        {initial.apiKeySet && (
          <button
            type="button"
            onClick={() => clearKey("apiKey")}
            className="mt-1 text-[11px] text-paper/40 underline hover:text-red-300"
          >
            Clear API token
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Webhook secret (any random string){" "}
          {initial.webhookSecretSet && (
            <span className="text-emerald-300">— currently set</span>
          )}
        </label>
        <input
          type="password"
          className={inp}
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={
            initial.webhookSecretSet
              ? "•••• (leave blank to keep)"
              : "openssl rand -base64 32"
          }
          autoComplete="off"
        />
        {initial.webhookSecretSet && (
          <button
            type="button"
            onClick={() => clearKey("webhookSecret")}
            className="mt-1 text-[11px] text-paper/40 underline hover:text-red-300"
          >
            Clear webhook secret
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={verify}
          disabled={busy || !initial.apiKeySet}
          className="rounded-full border border-white/15 px-5 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Verify connection
        </button>
        {verifyResult && (
          <span className="text-xs text-paper/70">{verifyResult}</span>
        )}
      </div>
    </form>
  );
}
