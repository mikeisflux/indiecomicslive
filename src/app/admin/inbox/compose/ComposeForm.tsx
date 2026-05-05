"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Prefill {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
}

interface Props {
  prefill?: Prefill;
  replyToId?: string;
  forwardFromId?: string;
  mode?: "new" | "reply" | "replyAll" | "forward";
}

export default function ComposeForm({
  prefill,
  replyToId,
  forwardFromId,
  mode = "new",
}: Props) {
  const router = useRouter();
  const [to, setTo] = useState(prefill?.to ?? "");
  const [cc, setCc] = useState(prefill?.cc ?? "");
  const [bcc, setBcc] = useState(prefill?.bcc ?? "");
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(prefill?.cc || prefill?.bcc),
  );
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && prefill?.html) {
      editorRef.current.innerHTML = prefill.html;
      // Place the caret at the very start so the user types ABOVE the
      // quoted original, not after it. Defer to next tick so the new
      // DOM nodes are mounted before we select.
      requestAnimationFrame(() => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const range = document.createRange();
        range.setStart(el, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    }
  }, [prefill?.html]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const html = editorRef.current?.innerHTML ?? "";
    const text = editorRef.current?.innerText ?? "";

    const fd = new FormData();
    fd.set("to", to);
    fd.set("cc", cc);
    fd.set("bcc", bcc);
    fd.set("subject", subject);
    fd.set("text", text);
    fd.set("html", html);
    if (replyToId) fd.set("replyToId", replyToId);
    if (forwardFromId) fd.set("forwardFromId", forwardFromId);
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
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-paper/60">
            To <span className="text-accent">*</span>
          </label>
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-paper/50 hover:text-paper"
            >
              + Cc / Bcc
            </button>
          )}
        </div>
        <input
          className={inp}
          placeholder="recipient@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      {showCcBcc && (
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
      )}
      <div>
        <label className="mb-1 block text-xs text-paper/60">Subject</label>
        <input
          className={inp}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-paper/60">Message</label>
        <RichTextEditor editorRef={editorRef} />
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
        {mode === "forward" && forwardFromId && (
          <p className="mt-1 text-xs text-paper/40">
            Original attachments are forwarded automatically. Add more above
            if you want.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
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

function RichTextEditor({
  editorRef,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
}) {
  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }
  function makeLink() {
    const url = window.prompt("URL:");
    if (!url) return;
    exec("createLink", url);
  }
  const btn =
    "rounded px-2 py-1 text-xs hover:bg-white/10 active:bg-white/20";

  return (
    <div className="rounded-lg border border-white/10 bg-black/40">
      <div className="flex flex-wrap gap-1 border-b border-white/10 p-1">
        <button type="button" className={btn} title="Bold (Ctrl+B)" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>
          <b>B</b>
        </button>
        <button type="button" className={btn} title="Italic (Ctrl+I)" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>
          <i>I</i>
        </button>
        <button type="button" className={btn} title="Underline" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}>
          <u>U</u>
        </button>
        <button type="button" className={btn} title="Strike" onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough"); }}>
          <s>S</s>
        </button>
        <span className="mx-1 w-px self-stretch bg-white/10" />
        <button type="button" className={btn} title="Bulleted list" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}>
          • List
        </button>
        <button type="button" className={btn} title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}>
          1. List
        </button>
        <button type="button" className={btn} title="Quote" onMouseDown={(e) => { e.preventDefault(); exec("formatBlock", "blockquote"); }}>
          ❝ Quote
        </button>
        <span className="mx-1 w-px self-stretch bg-white/10" />
        <button type="button" className={btn} title="Link" onMouseDown={(e) => { e.preventDefault(); makeLink(); }}>
          🔗 Link
        </button>
        <button type="button" className={btn} title="Remove formatting" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}>
          ⌫ Plain
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="prose prose-invert max-w-none min-h-[260px] p-3 text-sm focus:outline-none"
      />
    </div>
  );
}
