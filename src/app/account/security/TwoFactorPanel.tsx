"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TwoFactorPanel({
  enrolled,
  backupCodesRemaining,
}: {
  enrolled: boolean;
  backupCodesRemaining: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<
    "idle" | "enrolling" | "enrolled" | "disabling"
  >(enrolled ? "enrolled" : "idle");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/account/2fa");
      const j = await r.json();
      if (!r.ok || !j.secret) {
        setErr(j.error || "Could not start enrollment");
        return;
      }
      setSecret(j.secret);
      setOtpauth(j.otpauth);
      setPhase("enrolling");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error === "wrong_code" ? "That code didn't match." : "Could not verify");
        return;
      }
      if (j.backupCodes) setBackupCodes(j.backupCodes);
      setPhase("enrolled");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/account/2fa", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s|-/g, "") }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(
          j.error === "wrong_code"
            ? "That code didn't match. Try a backup code."
            : "Could not disable",
        );
        return;
      }
      setPhase("idle");
      setCode("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
        Two-factor (TOTP)
      </h2>

      {phase === "idle" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-paper/70">
            Use any TOTP-compatible app — Google Authenticator, 1Password,
            Authy, Bitwarden, your password manager.
          </p>
          <button
            onClick={start}
            disabled={busy}
            className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Set up two-factor"}
          </button>
        </div>
      )}

      {phase === "enrolling" && (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-paper/70">
            Add this account to your authenticator. Most apps let you tap
            the link below; or paste the manual code.
          </p>
          <a
            href={otpauth}
            className="block break-all rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-accent hover:underline"
          >
            {otpauth}
          </a>
          <div>
            <p className="mb-1 text-xs text-paper/50">Manual setup code</p>
            <p className="rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm tracking-widest">
              {secret}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-paper/60">
              Enter the 6-digit code from your app
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base font-mono tracking-widest"
              placeholder="123 456"
              maxLength={7}
            />
          </div>
          {err && <p className="text-sm text-red-300">{err}</p>}
          <button
            onClick={verify}
            disabled={busy || code.length < 6}
            className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Turn on 2FA"}
          </button>
        </div>
      )}

      {phase === "enrolled" && (
        <div className="mt-4 space-y-4 text-sm">
          <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-emerald-200">
            Two-factor is on. {backupCodesRemaining} backup code
            {backupCodesRemaining === 1 ? "" : "s"} remaining.
          </p>
          {backupCodes && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Save these backup codes
              </p>
              <p className="mt-1 text-xs text-paper/70">
                Use any one of these instead of your authenticator code if
                you lose your device. Each works once. We won&rsquo;t show
                them again.
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm">
                {backupCodes.map((c) => (
                  <li
                    key={c}
                    className="rounded bg-black/40 px-2 py-1 tracking-widest"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-paper/60">
              To disable, enter a current 6-digit code or one backup code.
            </p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code"
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono tracking-widest"
              />
              <button
                onClick={disable}
                disabled={busy || code.length < 6}
                className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-50"
              >
                {busy ? "…" : "Disable"}
              </button>
            </div>
            {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
