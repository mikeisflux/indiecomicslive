"use client";

import { useEffect, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

type Props = {
  // Where to confirm the saved payment method server-side. Pass
  //   /api/seller/chargeback-card/dc/confirm  for seller chargeback
  //   /api/payment-methods/dc/confirm         for buyer card-on-file
  // Both endpoints accept { setupIntentId, paymentMethodId }.
  confirmUrl?: string;
  // Where to fetch the SetupIntent client secret + publishable key.
  intentUrl?: string;
  onSuccess: (id: string) => void;
  onError: (message: string) => void;
};

// Outer component: fetches the setup intent + publishable key from
// our backend (which calls DC's create-setup-intent under the hood),
// then mounts Stripe Elements pointed at that intent. Inner form
// runs stripe.confirmSetup and reports the resulting payment method
// back to our /confirm endpoint.
export function DcCardForm({
  confirmUrl = "/api/payment-methods/dc/confirm",
  intentUrl = "/api/payment-methods/dc/intent",
  onSuccess,
  onError,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(intentUrl, { method: "POST" });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data?.detail || data?.error || "Failed to start card form");
        }
        if (cancelled) return;
        setStripePromise(loadStripe(data.publishableKey));
        setClientSecret(data.clientSecret);
      } catch (e) {
        const m = e instanceof Error ? e.message : "Could not load card form";
        setError(m);
        onError(m);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentUrl]);

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
        {error}
      </p>
    );
  }
  if (!clientSecret || !stripePromise) {
    return (
      <p className="text-center text-sm text-paper/60">Loading card form…</p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#ff3366",
            colorBackground: "#0a0a0a",
            colorText: "#f5f1e8",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            borderRadius: "8px",
          },
          rules: {
            ".Input": { backgroundColor: "rgba(0,0,0,0.4)" },
          },
        },
      }}
    >
      <DcConfirmInner confirmUrl={confirmUrl} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}

function DcConfirmInner({
  confirmUrl,
  onSuccess,
  onError,
}: {
  confirmUrl: string;
  onSuccess: (id: string) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
  }, [onError, onSuccess]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErrMsg(null);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      setBusy(false);
      const m = error.message || "Card declined";
      setErrMsg(m);
      onErrorRef.current(m);
      return;
    }

    const paymentMethodId = (setupIntent?.payment_method as string | undefined) ?? null;
    const setupIntentId = setupIntent?.id ?? null;
    if (!paymentMethodId || !setupIntentId) {
      setBusy(false);
      const m = "Stripe did not return a payment method id";
      setErrMsg(m);
      onErrorRef.current(m);
      return;
    }

    const r = await fetch(confirmUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupIntentId, paymentMethodId }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = data?.detail || data?.error || "Failed to save card";
      setErrMsg(m);
      onErrorRef.current(m);
      return;
    }
    onSuccessRef.current(paymentMethodId);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {errMsg && <p className="text-sm text-red-300">{errMsg}</p>}
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-ink shadow-lg shadow-accent/30 disabled:opacity-50"
      >
        {busy ? "Saving card…" : "Save card"}
      </button>
      <p className="text-center text-xs text-paper/40">
        Card details are tokenized in your browser by Divinity Payments —
        they never touch our servers.
      </p>
    </form>
  );
}
