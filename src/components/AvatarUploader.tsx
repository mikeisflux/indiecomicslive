"use client";

import { useRef, useState } from "react";

// Picks an image, validates ≤10MB, center-crops/resizes to 400×400 on a
// canvas, then uploads via a presigned R2 URL. Drops the public URL into
// the parent form via `onChange`. Replaces the old "paste an image URL"
// flow on /account.
const MAX_BYTES = 10 * 1024 * 1024;
const SIZE = 400;

export default function AvatarUploader({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick() {
    if (busy || disabled) return;
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Please pick an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("Avatar must be 10MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const blob = await resizeToSquare(file, SIZE);

      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: "avatar.webp",
          contentType: "image/webp",
          scope: "avatar",
        }),
      });
      if (!sign.ok) {
        const data = await sign.json().catch(() => ({}));
        throw new Error(data.error || "sign_failed");
      }
      const { uploadUrl, publicUrl } = (await sign.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "image/webp" },
        body: blob,
      });
      if (!put.ok) throw new Error("upload_failed");

      onChange(publicUrl);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Upload failed — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (busy || disabled) return;
    onChange("");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/40">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Avatar preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl text-paper/40">?</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={busy || disabled}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
          >
            {busy ? "Uploading…" : value ? "Replace" : "Upload avatar"}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-paper/80 hover:bg-white/5"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-paper/50">
          PNG, JPG, or WebP up to 10MB. We crop to 400×400.
        </p>
        {err && <p className="text-xs text-red-300">{err}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// Center-crop "cover" + resize to `size`×`size`. Falls back to PNG if
// the browser can't encode WebP (very old Safari).
async function resizeToSquare(file: File, size: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");

    const scale = Math.max(size / img.width, size / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);

    const blob = await canvasToBlob(canvas, "image/webp", 0.9);
    if (blob) return blob;
    const png = await canvasToBlob(canvas, "image/png");
    if (png) return png;
    throw new Error("encode_failed");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode_failed"));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
