"use client";

import Link from "next/link";
import { useState } from "react";

interface Row {
  id: string;
  query: string;
  lastEmailedAt: string | null;
  createdAt: string;
}

export default function SavedSearchList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Remove this saved search?")) return;
    setBusy(id);
    const r = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) {
      setRows((p) => p.filter((x) => x.id !== id));
    }
  }

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
        Nothing saved yet. Run a query at{" "}
        <Link href="/search" className="text-accent hover:underline">
          /search
        </Link>{" "}
        and hit &ldquo;Save this search&rdquo;.
      </p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/search?q=${encodeURIComponent(r.query)}`}
              className="truncate font-semibold hover:underline"
            >
              {r.query}
            </Link>
            <p className="mt-0.5 text-xs text-paper/50">
              Saved {new Date(r.createdAt).toLocaleDateString()}
              {r.lastEmailedAt
                ? ` · last emailed ${new Date(r.lastEmailedAt).toLocaleDateString()}`
                : " · awaiting first match"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => remove(r.id)}
            disabled={busy === r.id}
            className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-red-300/50 hover:text-red-300 disabled:opacity-50"
          >
            {busy === r.id ? "…" : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}
