"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export default function ThreadView({
  conversationId,
  meId,
  initial,
}: {
  conversationId: string;
  meId: string;
  initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Light polling: pull latest every 5s while the page is visible.
  // Cheap; can replace with WS later.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const r = await fetch(`/api/messages/${conversationId}`);
      if (cancelled || !r.ok) return;
      const data = (await r.json()) as { messages: Message[] };
      setMessages(data.messages);
    }
    const id = setInterval(() => {
      if (!document.hidden) poll();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversationId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Send failed");
      return;
    }
    setMessages((p) => [...p, data.message]);
    setDraft("");
  }

  return (
    <>
      <ul className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        {messages.length === 0 ? (
          <li className="py-8 text-center text-sm text-paper/40">
            No messages yet. Say hello.
          </li>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <li
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-accent text-white"
                      : "border border-white/10 bg-black/40"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? "text-white/70" : "text-paper/40"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </li>
            );
          })
        )}
        <div ref={endRef} />
      </ul>

      <form onSubmit={send} className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          maxLength={4000}
          className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </>
  );
}
