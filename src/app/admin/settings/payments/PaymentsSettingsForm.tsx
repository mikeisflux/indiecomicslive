"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  activeProcessor: "nmi" | "divinitycoin";
  divinityCoinEnabled: boolean;
  divinityCoinApiKey: string | null;
  divinityCoinPublicKey: string | null;
  divinityCoinPrivateKey: string | null;
  divinityCoinPartnerId: string | null;
  divinityCoinWebhookSecret: string | null;
  divinityCoinBaseUrl: string | null;
};

export default function PaymentsSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings/payments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activeProcessor: s.activeProcessor,
        divinityCoinEnabled: s.divinityCoinEnabled,
        divinityCoinApiKey: s.divinityCoinApiKey || null,
        divinityCoinPublicKey: s.divinityCoinPublicKey || null,
        divinityCoinPrivateKey: s.divinityCoinPrivateKey || null,
        divinityCoinPartnerId: s.divinityCoinPartnerId || null,
        divinityCoinWebhookSecret: s.divinityCoinWebhookSecret || null,
        divinityCoinBaseUrl: s.divinityCoinBaseUrl || null,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      const issues = Array.isArray(data?.issues) ? data.issues : [];
      setMsg(
        issues.length
          ? issues
              .map((i: { path: string; message: string }) =>
                i.path ? `${i.path}: ${i.message}` : i.message,
              )
              .join(" · ")
          : (data.error ?? "Save failed"),
      );
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  async function pingDC() {
    setPingResult("Testing…");
    const r = await fetch("/api/admin/settings/payments/test", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setPingResult(
      data?.ok
        ? `OK (HTTP 2xx)`
        : `Failed: ${data?.error ?? "unknown"} ${data?.status ? `(HTTP ${data.status})` : ""}`,
    );
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
          Active processor
        </h2>
        <p className="mt-1 text-xs text-paper/60">
          Buyer charges and seller bank/chargeback collection use the
          processor selected here.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {(["nmi", "divinitycoin"] as const).map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
                s.activeProcessor === opt
                  ? "border-accent/60 bg-accent/10"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="processor"
                value={opt}
                checked={s.activeProcessor === opt}
                onChange={() => update("activeProcessor", opt)}
              />
              <span>
                <span className="block font-semibold capitalize">
                  {opt === "nmi" ? "PaymentCloud (NMI)" : "Divinity Payments"}
                </span>
                <span className="block text-xs text-paper/60">
                  {opt === "nmi"
                    ? "Direct Post + CollectJS card form, vault stored on PaymentCloud."
                    : "Stripe-powered card form on Divinity's partner account, refunds + ledger via the Divinity Payments API."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
              DivinityCoin partner credentials
            </h2>
            <p className="mt-1 text-xs text-paper/60">
              Get these from DC&rsquo;s partner portal. The webhook URL to
              configure on DC&rsquo;s side is{" "}
              <code className="rounded bg-black/40 px-1">
                https://indiecomicslive.com/api/webhooks/divinitycoin
              </code>
              .
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-paper/60">
            <input
              type="checkbox"
              checked={s.divinityCoinEnabled}
              onChange={(e) => update("divinityCoinEnabled", e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-paper/60">API key</label>
            <input
              className={inp}
              type="password"
              autoComplete="off"
              placeholder="sk_indiecomicslive-com_…"
              value={s.divinityCoinApiKey ?? ""}
              onChange={(e) =>
                update("divinityCoinApiKey", e.target.value || null)
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-paper/60">Public key</label>
              <input
                className={inp}
                type="password"
                autoComplete="off"
                placeholder="sk_indiecomicslive-com_…"
                value={s.divinityCoinPublicKey ?? ""}
                onChange={(e) =>
                  update("divinityCoinPublicKey", e.target.value || null)
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-paper/60">Private key</label>
              <input
                className={inp}
                type="password"
                autoComplete="off"
                placeholder="sk_indiecomicslive-com_…"
                value={s.divinityCoinPrivateKey ?? ""}
                onChange={(e) =>
                  update("divinityCoinPrivateKey", e.target.value || null)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-paper/60">
                Partner ID
              </label>
              <input
                className={inp}
                placeholder="indiecomicslive"
                value={s.divinityCoinPartnerId ?? ""}
                onChange={(e) =>
                  update("divinityCoinPartnerId", e.target.value || null)
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-paper/60">
                Base URL (override)
              </label>
              <input
                className={inp}
                placeholder="https://divinitycoin.com/internal"
                value={s.divinityCoinBaseUrl ?? ""}
                onChange={(e) =>
                  update("divinityCoinBaseUrl", e.target.value || null)
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-paper/60">
              Webhook secret
            </label>
            <input
              className={inp}
              type="password"
              autoComplete="off"
              placeholder="whsec_..."
              value={s.divinityCoinWebhookSecret ?? ""}
              onChange={(e) =>
                update("divinityCoinWebhookSecret", e.target.value || null)
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={pingDC}
            className="rounded-full border border-white/15 px-4 py-2 text-xs"
          >
            Test DC ping
          </button>
          {msg && <span className="text-xs text-paper/70">{msg}</span>}
          {pingResult && (
            <span className="text-xs text-paper/70">DC: {pingResult}</span>
          )}
        </div>
      </section>
    </div>
  );
}
