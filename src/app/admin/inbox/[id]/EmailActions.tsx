"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  initial: { starred: boolean; archived: boolean; read: boolean };
};

export default function EmailActions({ id, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function patch(patch: Partial<typeof state>) {
    setBusy(true);
    setState((p) => ({ ...p, ...patch }));
    const r = await fetch(`/api/admin/inbox/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!r.ok) {
      // revert on failure
      setState((p) => ({ ...p, ...initial }));
      alert("Update failed");
      return;
    }
    router.refresh();
  }

  async function del() {
    if (!confirm("Delete this email?")) return;
    setBusy(true);
    const r = await fetch(`/api/admin/inbox/${id}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) router.push("/admin/inbox");
    else alert("Delete failed");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => patch({ starred: !state.starred })}
        disabled={busy}
        className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
          state.starred
            ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
            : "border-white/15 text-paper hover:bg-white/5"
        }`}
      >
        {state.starred ? "★ Starred" : "☆ Star"}
      </button>
      <button
        onClick={() => patch({ read: !state.read })}
        disabled={busy}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-paper hover:bg-white/5"
      >
        {state.read ? "Mark unread" : "Mark read"}
      </button>
      <button
        onClick={() => patch({ archived: !state.archived })}
        disabled={busy}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-paper hover:bg-white/5"
      >
        {state.archived ? "Unarchive" : "Archive"}
      </button>
      <button
        onClick={del}
        disabled={busy}
        className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
      >
        Delete
      </button>
    </div>
  );
}
