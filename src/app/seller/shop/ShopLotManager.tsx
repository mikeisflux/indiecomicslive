"use client";

import { useState } from "react";

type ShopLot = {
  id: string;
  kind: "buy_now" | "mystery";
  title: string;
  imageUrl: string | null;
  buyNowCents: number | null;
  inventoryCount: number;
  status: string;
};

export default function ShopLotManager({
  initialLots,
}: {
  initialLots: ShopLot[];
}) {
  const [lots, setLots] = useState<ShopLot[]>(initialLots);
  const [creating, setCreating] = useState(false);

  function onCreated(lot: ShopLot) {
    setLots((p) => [lot, ...p]);
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Listings ({lots.length})
        </h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-full border border-white/10 px-3 py-1 text-xs"
        >
          {creating ? "Cancel" : "+ New listing"}
        </button>
      </div>

      {creating && <CreateForm onCreated={onCreated} />}

      {lots.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          Nothing listed yet. Hit &ldquo;+ New listing&rdquo; to add a Buy-Now
          or Mystery item.
        </p>
      ) : (
        <ul className="space-y-2">
          {lots.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm"
            >
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
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {l.title}{" "}
                  {l.kind === "mystery" && (
                    <span className="ml-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                      Mystery
                    </span>
                  )}
                </p>
                <p className="text-xs text-paper/60">
                  ${((l.buyNowCents ?? 0) / 100).toFixed(2)} ·{" "}
                  {l.inventoryCount === 0
                    ? "sold out"
                    : `${l.inventoryCount} in stock`}{" "}
                  · {l.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (lot: ShopLot) => void }) {
  const [kind, setKind] = useState<"buy_now" | "mystery">("buy_now");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("10.00");
  const [inventory, setInventory] = useState("1");
  const [shippingCost, setShippingCost] = useState("0.00");
  const [mysteryContents, setMysteryContents] = useState("");
  const [mysteryItemCount, setMysteryItemCount] = useState("3");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    if (!r.ok) return null;
    const { uploadUrl, publicUrl } = await r.json();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    return put.ok ? publicUrl : null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    let imageUrl: string | undefined;
    if (imageFile) {
      const url = await uploadImage(imageFile);
      if (!url) {
        setErr("Image upload failed");
        setBusy(false);
        return;
      }
      imageUrl = url;
    }
    const body: Record<string, unknown> = {
      kind,
      title,
      description: description || undefined,
      imageUrl,
      buyNowCents: Math.round(Number(price) * 100),
      inventoryCount: Math.max(1, Math.round(Number(inventory))),
      shippingCostCents: Math.max(0, Math.round(Number(shippingCost) * 100)),
      startingBidCents: 0,
    };
    if (kind === "mystery") {
      body.mysteryContentsHtml = mysteryContents || undefined;
      const n = Math.round(Number(mysteryItemCount));
      if (Number.isFinite(n) && n > 0) body.mysteryItemCount = n;
    }
    const r = await fetch("/api/lots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const data = await r.json();
    if (!r.ok) {
      setErr(data.message || data.error || "Could not create listing");
      return;
    }
    onCreated({
      id: data.lot.id,
      kind: data.lot.kind,
      title: data.lot.title,
      imageUrl: data.lot.imageUrl ?? null,
      buyNowCents: data.lot.buyNowCents,
      inventoryCount: data.lot.inventoryCount,
      status: data.lot.status,
    });
    setTitle("");
    setDescription("");
    setImageFile(null);
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div>
        <label className="mb-1 block text-xs text-paper/60">Type</label>
        <div className="flex gap-2 text-xs">
          {(
            [
              { id: "buy_now", label: "Buy now" },
              { id: "mystery", label: "Mystery" },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-full px-3 py-1.5 ${
                kind === k.id
                  ? "bg-accent text-white"
                  : "border border-white/10 text-paper/70"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Listing title"
        required
        className={inp}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={
          kind === "mystery"
            ? "Buyer-visible description (kept generic; contents stay hidden)"
            : "Description (optional)"
        }
        rows={3}
        className={`${inp} resize-y`}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-paper/60">
          Price ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inp}
          />
        </label>
        <label className="space-y-1 text-xs text-paper/60">
          Inventory
          <input
            type="number"
            min="1"
            step="1"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            className={inp}
          />
        </label>
      </div>
      {kind === "mystery" && (
        <div className="space-y-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
          <p className="text-xs text-purple-200">
            Mystery boxes hide contents from the buyer until they purchase.
          </p>
          <label className="block space-y-1 text-xs text-paper/60">
            Items inside (count shown to buyer)
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              value={mysteryItemCount}
              onChange={(e) => setMysteryItemCount(e.target.value)}
              className={inp}
            />
          </label>
          <label className="block space-y-1 text-xs text-paper/60">
            Hidden contents (revealed after purchase, supports basic HTML)
            <textarea
              value={mysteryContents}
              onChange={(e) => setMysteryContents(e.target.value)}
              rows={4}
              placeholder={`<ul>\n  <li>1x Comic A</li>\n  <li>1x Mystery sketch card</li>\n</ul>`}
              className={`${inp} resize-y font-mono text-xs`}
            />
          </label>
        </div>
      )}
      <label className="block space-y-1 text-xs text-paper/60">
        Shipping cost ($) — added to the buyer&rsquo;s total
        <input
          type="number"
          min="0"
          step="0.01"
          value={shippingCost}
          onChange={(e) => setShippingCost(e.target.value)}
          className={inp}
        />
      </label>
      <label className="block space-y-1 text-xs text-paper/60">
        Cover image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs"
        />
      </label>
      {err && <p className="text-xs text-accent">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Listing…" : "List it"}
      </button>
    </form>
  );
}
