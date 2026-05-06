"use client";

import { useState } from "react";

type Lot = {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  startingBidCents: number;
  minIncrementCents: number;
  status: string;
  currentBidCents: number | null;
  bidCount: number;
};

type Props = {
  showId: string;
  initialLots: Lot[];
  pinnedLotId?: string | null;
  onPinChange?: (lotId: string | null) => void;
};

export default function LotManager({
  showId,
  initialLots,
  pinnedLotId,
  onPinChange,
}: Props) {
  const [lots, setLots] = useState<Lot[]>(initialLots);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  async function togglePin(lotId: string) {
    if (!onPinChange) return;
    const next = pinnedLotId === lotId ? null : lotId;
    setPinBusy(lotId);
    const r = await fetch(`/api/seller/shows/${showId}/pin`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lotId: next }),
    });
    setPinBusy(null);
    if (r.ok) onPinChange(next);
  }

  async function startNext() {
    setError(null);
    const res = await fetch("/api/lots/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId, durationSeconds: duration }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start lot");
      return;
    }
    const data = await res.json();
    setLots((prev) =>
      prev.map((l) => (l.id === data.lot.id ? { ...l, status: "live" } : l)),
    );
  }

  function onCreated(lot: Lot) {
    setLots((prev) => [...prev, lot]);
    setCreating(false);
  }

  const queued = lots.filter((l) => l.status === "queued");
  const live = lots.find((l) => l.status === "live");
  const sold = lots.filter((l) => l.status === "sold");

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest text-paper/60">
            Live lot
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-paper/60">Duration (s)</label>
            <input
              type="number"
              min={10}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm"
            />
            <button
              onClick={startNext}
              disabled={!!live || queued.length === 0}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Start next
            </button>
          </div>
        </div>
        {live ? (
          <div className="text-sm">
            <p className="font-semibold">{live.title}</p>
            <p className="text-xs text-paper/60">
              {live.currentBidCents
                ? `Current $${(live.currentBidCents / 100).toFixed(2)} · ${live.bidCount} bid${live.bidCount === 1 ? "" : "s"}`
                : `Start $${(live.startingBidCents / 100).toFixed(2)}`}
            </p>
          </div>
        ) : queued.length === 0 ? (
          <p className="text-sm text-paper/60">No queued lots. Add some below.</p>
        ) : (
          <p className="text-sm text-paper/60">
            {queued.length} lot{queued.length === 1 ? "" : "s"} queued. Hit
            &ldquo;Start next&rdquo; when you&rsquo;re ready.
          </p>
        )}
        {error && <p className="text-xs text-accent">{error}</p>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
            Queue
          </h3>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs"
          >
            {creating ? "Cancel" : "Add lot"}
          </button>
        </div>

        {creating && (
          <CreateLotForm showId={showId} onCreated={onCreated} />
        )}

        {queued.length === 0 ? (
          <p className="text-sm text-paper/40">No queued lots.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {queued.map((l) => {
              const isPinned = pinnedLotId === l.id;
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <span className="w-6 text-right text-xs text-paper/40">
                    #{l.position}
                  </span>
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-white/5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {l.title}
                      {isPinned && (
                        <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                          Pinned
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-paper/60">
                      Start ${(l.startingBidCents / 100).toFixed(2)} · +$
                      {(l.minIncrementCents / 100).toFixed(2)} min
                    </p>
                  </div>
                  {onPinChange && (
                    <button
                      type="button"
                      onClick={() => togglePin(l.id)}
                      disabled={pinBusy !== null}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                        isPinned
                          ? "border-accent/40 text-accent"
                          : "border-white/10 text-paper/70 hover:border-white/20"
                      }`}
                    >
                      {pinBusy === l.id
                        ? "…"
                        : isPinned
                          ? "Unpin"
                          : "Pin"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sold.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
            Sold
          </h3>
          <ul className="divide-y divide-white/5">
            {sold.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="truncate">{l.title}</span>
                <span className="text-xs text-paper/60">
                  ${((l.currentBidCents ?? 0) / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CreateLotForm({
  showId,
  onCreated,
}: {
  showId: string;
  onCreated: (lot: Lot) => void;
}) {
  const [title, setTitle] = useState("");
  const [startingBid, setStartingBid] = useState("1.00");
  const [minIncrement, setMinIncrement] = useState("1.00");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File): Promise<string | null> {
    const r = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        scope: "lot",
      }),
    });
    if (!r.ok) {
      setError("Upload sign failed");
      return null;
    }
    const { uploadUrl, publicUrl } = await r.json();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!put.ok) {
      setError("Upload failed");
      return null;
    }
    return publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const url = await uploadImage(imageFile);
        if (!url) return;
        imageUrl = url;
      }

      const r = await fetch("/api/lots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          showId,
          title,
          imageUrl,
          startingBidCents: Math.round(Number(startingBid) * 100),
          minIncrementCents: Math.round(Number(minIncrement) * 100),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to create lot");
        return;
      }
      onCreated({
        ...data.lot,
        currentBidCents: data.lot.currentBidCents ?? null,
        bidCount: data.lot.bidCount ?? 0,
        imageUrl: data.lot.imageUrl ?? null,
      });
      setTitle("");
      setImageFile(null);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Lot title"
        required
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-paper/60">
          Starting bid ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={startingBid}
            onChange={(e) => setStartingBid(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-paper/60">
          Min increment ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={minIncrement}
            onChange={(e) => setMinIncrement(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-paper/60">
        Cover image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs"
        />
      </label>
      {error && <p className="text-xs text-accent">{error}</p>}
      <button
        disabled={submitting}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add lot"}
      </button>
    </form>
  );
}
