"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  state: {
    locked: boolean;
    banned: boolean;
    chatBanned: boolean;
    role: string;
    lastKnownIP: string | null;
  };
  isSelf: boolean;
};

export default function UserActions({ userId, state, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState(state.role);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        Actions
      </h2>
      {isSelf && (
        <p className="text-xs text-amber-300">
          That&rsquo;s you. Be careful with destructive actions.
        </p>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (recorded in audit log)"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Btn
          onClick={() =>
            call({ action: state.locked ? "unlock" : "lock", reason })
          }
          disabled={busy}
          tone={state.locked ? "default" : "warn"}
        >
          {state.locked ? "Unlock account" : "Lock account"}
        </Btn>
        <Btn
          onClick={() => call({ action: state.banned ? "unban" : "ban", reason })}
          disabled={busy || isSelf}
          tone={state.banned ? "default" : "danger"}
        >
          {state.banned ? "Unban" : "Ban"}
        </Btn>
        <Btn
          onClick={() =>
            call({
              action: state.chatBanned ? "chat_unban" : "chat_ban",
              reason,
            })
          }
          disabled={busy || isSelf}
          tone={state.chatBanned ? "default" : "warn"}
        >
          {state.chatBanned ? "Unmute chat" : "Mute chat"}
        </Btn>
        <Btn
          onClick={() =>
            call({
              action: "ip_block",
              ip: state.lastKnownIP,
              reason,
            })
          }
          disabled={busy || !state.lastKnownIP}
          tone="danger"
        >
          {state.lastKnownIP
            ? `Block IP ${state.lastKnownIP}`
            : "No known IP"}
        </Btn>
      </div>

      <div className="border-t border-white/10 pt-3">
        <label className="text-xs text-paper/60">Role</label>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            <option value="viewer">viewer</option>
            <option value="seller">seller</option>
            <option value="admin">admin</option>
            <option value="super_admin">super_admin</option>
          </select>
          <Btn
            onClick={() =>
              call({ action: "set_role", role, reason })
            }
            disabled={busy || role === state.role}
            tone="warn"
          >
            Update role
          </Btn>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </section>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "warn" | "danger";
}) {
  const c =
    tone === "danger"
      ? "border-red-500/60 bg-red-500/10 text-red-300"
      : tone === "warn"
        ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
        : "border-white/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 disabled:opacity-40 ${c}`}
    >
      {children}
    </button>
  );
}
