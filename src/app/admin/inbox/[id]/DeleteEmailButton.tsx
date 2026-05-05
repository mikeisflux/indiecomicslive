"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEmailButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        if (!confirm("Delete this email?")) return;
        setBusy(true);
        const r = await fetch(`/api/admin/inbox/${id}`, { method: "DELETE" });
        setBusy(false);
        if (r.ok) router.push("/admin/inbox");
        else alert("Delete failed");
      }}
      disabled={busy}
      className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
