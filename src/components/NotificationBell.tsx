"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

// Bell with unread dot. Polls /api/notifications every 60s. On click,
// shows a dropdown with the most recent 50 and marks them all read.
export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* swallow */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openAndMarkRead() {
    setOpen((v) => !v);
    if (unread > 0) {
      await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
      setUnread(0);
      setItems((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={openAndMarkRead}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 text-base hover:border-white/30"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(255,51,102,0.6)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="icl-glass absolute right-0 mt-2 max-h-[70vh] w-80 overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-widest text-paper/60">
              Notifications
            </span>
            <Link
              href="/account/notifications"
              className="text-accent hover:underline"
              onClick={() => setOpen(false)}
            >
              See all
            </Link>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-paper/50">
                Nothing yet — when something happens you&rsquo;ll see it here.
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.url ?? "/account/notifications"}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-white/5 px-3 py-2.5 transition hover:bg-white/5 ${
                    n.readAt ? "" : "bg-accent/[0.04]"
                  }`}
                >
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-paper/60">
                    {n.body}
                  </p>
                  <p className="mt-0.5 text-[10px] text-paper/40">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
