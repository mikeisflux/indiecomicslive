"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  name: string | null;
  email: string | null;
  image: string | null;
  handle: string | null;
  bio: string | null;
  location: string | null;
  websites: string[];
}

export default function AccountForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [image, setImage] = useState(initial.image ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [websites, setWebsites] = useState((initial.websites ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || null,
        handle: handle.trim().toLowerCase() || null,
        image: image.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        websites: websites
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(data.message || data.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs text-paper/60";

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Display name</label>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Handle (lowercase a-z, 0-9, _)</label>
          <input
            className={inp}
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            pattern="[a-z0-9_]*"
            minLength={0}
            maxLength={20}
            placeholder="yourname"
          />
        </div>
      </div>
      <div>
        <label className={lbl}>Email</label>
        <input className={inp} value={initial.email ?? ""} disabled />
      </div>
      <div>
        <label className={lbl}>Avatar URL</label>
        <input
          className={inp}
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div>
        <label className={lbl}>Bio</label>
        <textarea
          className={`${inp} min-h-[100px]`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
        />
      </div>
      <div>
        <label className={lbl}>Location</label>
        <input
          className={inp}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={120}
        />
      </div>
      <div>
        <label className={lbl}>Websites (one per line)</label>
        <textarea
          className={`${inp} min-h-[80px] font-mono`}
          value={websites}
          onChange={(e) => setWebsites(e.target.value)}
          placeholder={"https://yoursite.com\nhttps://twitter.com/you"}
        />
      </div>

      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
