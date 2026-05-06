"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Toast = {
  id: string;
  body: string;
  kind: "info" | "success" | "error";
};

const Ctx = createContext<{
  show: (body: string, kind?: Toast["kind"]) => void;
} | null>(null);

// Tiny toast system. Wrap children in <ToasterProvider>; call useToast()
// to push a message. Toasts auto-dismiss after 4s; max 3 visible.
export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  function show(body: string, kind: Toast["kind"] = "info") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((q) => [...q.slice(-2), { id, body, kind }]);
    setTimeout(() => {
      setItems((q) => q.filter((t) => t.id !== id));
    }, 4000);
  }
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <Viewport items={items} onDismiss={(id) =>
        setItems((q) => q.filter((t) => t.id !== id))
      } />
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  return (
    v ?? {
      show: (body: string) => {
        if (typeof window !== "undefined") {
          // Dev fallback when ToasterProvider isn't mounted yet.
          console.log("[toast]", body);
        }
      },
    }
  );
}

function Viewport({
  items,
  onDismiss,
}: {
  items: Toast[];
  onDismiss: (id: string) => void;
}) {
  // Mounting flag prevents a hydration mismatch when state already
  // contains items (it can't, but guard is cheap).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col items-stretch gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto icl-fade-up cursor-pointer rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-md ${
            t.kind === "error"
              ? "border-red-400/50 bg-red-500/15 text-red-200"
              : t.kind === "success"
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                : "border-white/15 bg-black/70 text-paper"
          }`}
        >
          {t.body}
        </div>
      ))}
    </div>
  );
}
