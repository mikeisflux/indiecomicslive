"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ComposeForm() {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("to", to);
    fd.set("cc", cc);
    fd.set("bcc", bcc);
    fd.set("subject", subject);
    fd.set("text", body);
    if (files) {
      for (const f of Array.from(files)) fd.append("attachments", f);
    }
    const r = await fetch("/api/admin/inbox/compose", {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || data.detail || data.error || "Send failed");
      return;
    }
    router.push(`/admin/inbox/${data.id}`);
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form onSubmit={send} className="mt-6 space-y-3">
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          To <span className="text-accent">*</span>
        </label>
        <input
          className={inp}
          placeholder="recipient@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-paper/60">Cc</label>
          <input
            className={inp}
            value={cc}
            onChange={(e) => setCc(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-paper/60">Bcc</label>
          <input
            className={inp}
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">Subject</label>
        <input
          className={inp}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">Body</label>
        <textarea
          className={`${inp} min-h-[260px] font-mono`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Attachments (max 25 MB / file, 30 MB total)
        </label>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="text-sm text-paper/80 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-paper"
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/admin/inbox")}
          className="rounded-full border border-white/15 px-4 py-2 text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
