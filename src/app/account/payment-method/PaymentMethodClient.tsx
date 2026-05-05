"use client";

import { useEffect, useState } from "react";
import { CardFormRouter } from "@/components/payments/CardFormRouter";

type SavedMethod = {
  id: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isDefault: boolean;
};

export default function PaymentMethodClient({
  publicKey,
  processor,
}: {
  publicKey: string | null;
  processor: "nmi" | "divinitycoin";
}) {
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const r = await fetch("/api/payment-methods");
    if (r.ok) {
      const data = await r.json();
      setMethods(data.methods);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (adding || methods.length === 0) {
    return (
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {success}
          </p>
        )}
        <CardFormRouter
          processor={processor}
          nmiPublicKey={publicKey}
          dcIntentUrl="/api/payment-methods/dc/intent"
          dcConfirmUrl="/api/payment-methods/dc/confirm"
          onSuccess={() => {
            setSuccess("Card saved.");
            setError(null);
            setAdding(false);
            refresh();
          }}
          onError={(msg) => {
            setError(msg);
            setSuccess(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {methods.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-2xl border border-white/10 p-4"
        >
          <div>
            <p className="font-semibold">
              {m.cardBrand ?? "Card"} •••• {m.cardLast4 ?? "????"}
            </p>
            <p className="text-xs text-paper/60">
              {m.cardExpMonth && m.cardExpYear
                ? `Exp ${String(m.cardExpMonth).padStart(2, "0")}/${m.cardExpYear}`
                : null}
              {m.isDefault ? " · default" : null}
            </p>
          </div>
        </div>
      ))}
      <button
        onClick={() => setAdding(true)}
        className="w-full rounded-full border border-white/10 px-5 py-3 text-sm"
      >
        Replace card
      </button>
    </div>
  );
}
