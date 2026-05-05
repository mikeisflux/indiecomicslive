"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  enabled: boolean;
  siteKey: string;
  secretSet: boolean;
}

export default function RecaptchaSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [siteKey, setSiteKey] = useState(initial.siteKey);
  const [secretKey, setSecretKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const body: Record<string, unknown> = { enabled, siteKey: siteKey.trim() };
    // Only send the secret if the admin typed a new one — leaving it
    // blank means "keep the existing value." Send null explicitly to
    // wipe.
    if (secretKey.trim().length > 0) body.secretKey = secretKey.trim();
    const r = await fetch("/api/admin/settings/recaptcha", {
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
    setSecretKey("");
    router.refresh();
  }

  async function clearSecret() {
    if (!confirm("Clear the reCAPTCHA secret key?")) return;
    setBusy(true);
    const r = await fetch("/api/admin/settings/recaptcha", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false, siteKey, secretKey: null }),
    });
    setBusy(false);
    if (r.ok) {
      setMsg("Secret cleared. reCAPTCHA disabled.");
      router.refresh();
    }
  }

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono";

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enabled (require captcha on the listed forms)
      </label>

      <div>
        <label className="mb-1 block text-xs text-paper/60">Site key (public)</label>
        <input
          className={inp}
          value={siteKey}
          onChange={(e) => setSiteKey(e.target.value)}
          placeholder="6Lc..."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Secret key (server-only) {initial.secretSet && (
            <span className="text-emerald-300">— currently set</span>
          )}
        </label>
        <input
          className={inp}
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={initial.secretSet ? "•••• (leave blank to keep)" : "6Lc..."}
        />
        {initial.secretSet && (
          <button
            type="button"
            onClick={clearSecret}
            className="mt-1 text-[11px] text-paper/40 underline hover:text-red-300"
          >
            Clear secret
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
