"use client";

import { useState } from "react";

type Kind =
  | "outbid"
  | "show_live"
  | "show_reminder"
  | "saved_search"
  | "giveaway_won"
  | "seller_broadcast"
  | "order_update"
  | "dispute_update";

const ROWS: { kind: Kind; label: string }[] = [
  { kind: "outbid", label: "You've been outbid" },
  { kind: "show_live", label: "A seller you follow goes live" },
  { kind: "show_reminder", label: "Show going live soon" },
  { kind: "saved_search", label: "New matches for a saved search" },
  { kind: "giveaway_won", label: "You won a giveaway" },
  { kind: "seller_broadcast", label: "Seller announcements" },
  { kind: "order_update", label: "Order shipped / delivered" },
  { kind: "dispute_update", label: "Dispute updates" },
];

type Prefs = Partial<
  Record<Kind, Partial<Record<"push" | "email" | "sms", boolean>>>
>;

export default function NotifPrefsPanel({
  initialPrefs,
  initialPhone,
  initialSmsOptIn,
}: {
  initialPrefs: Prefs;
  initialPhone: string | null;
  initialSmsOptIn: boolean;
}) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function get(kind: Kind, channel: "push" | "email" | "sms"): boolean {
    const v = prefs[kind]?.[channel];
    return v === undefined ? true : v;
  }

  function set(kind: Kind, channel: "push" | "email" | "sms", value: boolean) {
    setPrefs((p) => ({
      ...p,
      [kind]: { ...(p[kind] ?? {}), [channel]: value },
    }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        prefs,
        smsOptIn,
      };
      if (phone.trim()) {
        const cleaned = phone.trim();
        if (!/^\+\d{8,15}$/.test(cleaned)) {
          setErr("Phone must be E.164 like +14155550100.");
          return;
        }
        body.phoneE164 = cleaned;
      } else {
        body.phoneE164 = null;
      }
      const r = await fetch("/api/account/notif-prefs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Could not save");
        return;
      }
      setMsg("Saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-widest text-paper/40">
            <th className="pb-2 text-left font-semibold">When</th>
            <th className="pb-2 px-2 text-center font-semibold">Push</th>
            <th className="pb-2 px-2 text-center font-semibold">Email</th>
            <th className="pb-2 px-2 text-center font-semibold">SMS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {ROWS.map(({ kind, label }) => (
            <tr key={kind}>
              <td className="py-2.5 pr-3 text-paper/80">{label}</td>
              {(["push", "email", "sms"] as const).map((ch) => (
                <td key={ch} className="px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={get(kind, ch)}
                    onChange={(e) => set(kind, ch, e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
        <div>
          <label className="mb-1 block text-xs text-paper/60">
            Phone (E.164) for SMS
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+14155550100"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-paper/80">
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          I&rsquo;m okay receiving transactional SMS at the number above.
          Carrier rates apply. Reply STOP to opt out.
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-300">{msg}</p>}
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(255,51,102,0.4)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
