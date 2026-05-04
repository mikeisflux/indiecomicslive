"use client";
import { useEffect, useState } from "react";

export default function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ok = document.cookie.split("; ").some((c) => c === "age_ok=1");
    if (!ok) setOpen(true);
  }, []);

  function confirm() {
    document.cookie = `age_ok=1; max-age=${60 * 60 * 24 * 30}; path=/; samesite=lax`;
    setOpen(false);
  }

  function reject() {
    window.location.href = "https://www.google.com";
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6">
      <div className="max-w-sm rounded-2xl border border-white/10 bg-ink p-6 text-center">
        <h2 className="text-xl font-bold">Adults only</h2>
        <p className="mt-3 text-sm text-paper/80">
          This site contains material intended for adults. By entering you
          confirm you are 18 or older and that adult content is legal in your
          jurisdiction.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={confirm}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-white"
          >
            I am 18 or older — enter
          </button>
          <button
            onClick={reject}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-paper/70"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
