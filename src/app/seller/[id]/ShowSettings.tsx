"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  trailerUrl: string | null;
  scheduledFor: string | null; // ISO string
  status: string;
}

// Local-time string for an <input type="datetime-local"> from an ISO
// timestamp. The picker has no timezone, so we format in the browser's
// own zone — round-tripping through new Date() preserves the moment
// even though the displayed numbers shift.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function ShowSettings({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(
    isoToLocalInput(initial.scheduledFor),
  );
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? "");
  const [trailerUrl, setTrailerUrl] = useState(initial.trailerUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "trailer" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function uploadFile(
    file: File,
    scope: "show",
  ): Promise<string | null> {
    const r = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        scope,
      }),
    });
    if (!r.ok) {
      setErr("Could not get upload URL");
      return null;
    }
    const { uploadUrl, publicUrl } = await r.json();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!put.ok) {
      setErr("Upload failed");
      return null;
    }
    return publicUrl;
  }

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading("cover");
    const url = await uploadFile(file, "show");
    setUploading(null);
    if (url) setCoverImageUrl(url);
  }

  async function onTrailerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading("trailer");
    const url = await uploadFile(file, "show");
    setUploading(null);
    if (url) setTrailerUrl(url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    let scheduledFor: string | null = null;
    if (scheduledLocal) {
      const d = new Date(scheduledLocal);
      if (Number.isNaN(d.getTime())) {
        setBusy(false);
        setErr("Invalid scheduled date.");
        return;
      }
      scheduledFor = d.toISOString();
    }
    const r = await fetch(`/api/seller/shows/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        scheduledFor,
        coverImageUrl: coverImageUrl || null,
        trailerUrl: trailerUrl || null,
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message ?? data.error ?? "Save failed");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs text-paper/60";
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Show details
        </h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className={lbl}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What you're selling tonight, special promos, etc."
              className={`${inp} resize-y`}
            />
          </div>
          <div>
            <label className={lbl}>
              Scheduled start (leave blank to start immediately)
            </label>
            <input
              type="datetime-local"
              min={nowLocal}
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              className={inp}
            />
            <p className="mt-1 text-xs text-paper/40">
              Status: <span className="font-mono">{initial.status}</span>
              {initial.status === "live"
                ? " — schedule has no effect once live."
                : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Cover image
        </h3>
        <p className="mt-1 text-xs text-paper/50">
          Shown on the homepage card and as the player poster before you go
          live.
        </p>
        <div className="mt-3 flex items-start gap-3">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt="Cover"
              className="h-20 w-32 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="h-20 w-32 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={onCoverChange}
              className="block w-full text-xs"
              disabled={uploading === "cover"}
            />
            {uploading === "cover" && (
              <p className="text-xs text-paper/60">Uploading…</p>
            )}
            {coverImageUrl && (
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
                className="text-xs text-red-300 hover:underline"
              >
                Remove cover
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Trailer
        </h3>
        <p className="mt-1 text-xs text-paper/50">
          Optional. Plays on the show page when you&rsquo;re not live yet so
          viewers know what they&rsquo;re tuning into. Mp4 / webm / mov.
        </p>
        <div className="mt-3 flex items-start gap-3">
          {trailerUrl ? (
            <video
              src={trailerUrl}
              controls
              className="h-32 w-56 shrink-0 rounded-lg bg-black object-cover"
            />
          ) : (
            <div className="h-32 w-56 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              accept="video/*"
              onChange={onTrailerChange}
              className="block w-full text-xs"
              disabled={uploading === "trailer"}
            />
            {uploading === "trailer" && (
              <p className="text-xs text-paper/60">
                Uploading… (large videos may take a minute)
              </p>
            )}
            {trailerUrl && (
              <button
                type="button"
                onClick={() => setTrailerUrl("")}
                className="text-xs text-red-300 hover:underline"
              >
                Remove trailer
              </button>
            )}
          </div>
        </div>
      </section>

      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || uploading !== null}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
