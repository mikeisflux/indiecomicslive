"use client";

import { useEffect, useRef, useState } from "react";
import { useCollectJsIframeVerify } from "./use-collectjs-iframe-verify";

declare global {
  interface Window {
    CollectJS?: {
      configure: (opts: Record<string, unknown>) => void;
      startPaymentRequest: (event?: unknown) => void;
      closePaymentRequest?: () => void;
    };
  }
}

interface CollectJsResponse {
  token: string;
  card?: {
    // CollectJS returns the card metadata alongside the tokenized
    // PAN. We forward this to /api/payment-methods so we have brand
    // / last4 / exp without an extra round-trip to NMI's validate-
    // vault endpoint (which requires CVV that PCI rules forbid us
    // from re-sending).
    number?: string; // masked PAN, e.g. "411111******1111"
    bin?: string;
    exp?: string; // "MMYY"
    type?: string; // "visa", "mastercard", "amex", ...
    name?: string;
  };
}

type Props = {
  publicKey: string;
  // Where to POST the tokenized card. Defaults to /api/payment-methods
  // for buyer cards; sellers' chargeback flow passes
  // /api/seller/chargeback-card so the card lands in the right table.
  submitUrl?: string;
  onSuccess: (methodId: string) => void;
  onError: (message: string) => void;
};

// Save-card form: tokenizes via CollectJS, posts the payment_token to
// the configured `submitUrl`, which vaults it on PaymentCloud and
// persists to whichever per-flow table is appropriate.
//
// Hardcoded to the marketplace pattern from indiecrowdfund_2.0 since
// that flow is the closest analog (cardholder-present, no AoN hold).
export function NmiCardForm({
  publicKey,
  submitUrl = "/api/payment-methods",
  onSuccess,
  onError,
}: Props) {
  const [scriptReady, setScriptReady] = useState(false);
  const { loadFailed: cardFormLoadFailed } = useCollectJsIframeVerify({
    scriptReady,
    ccnumberId: "nmi-ccnumber",
    setScriptReady,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const setIsProcessingRef = useRef(setIsProcessing);
  const billingRef = useRef({
    firstName,
    lastName,
    line1,
    line2,
    city,
    stateField,
    zip,
    country,
  });

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    setIsProcessingRef.current = setIsProcessing;
    billingRef.current = {
      firstName,
      lastName,
      line1,
      line2,
      city,
      stateField,
      zip,
      country,
    };
  }, [
    onSuccess,
    onError,
    firstName,
    lastName,
    line1,
    line2,
    city,
    stateField,
    zip,
    country,
  ]);

  useEffect(() => {
    if (!publicKey) return;
    if (typeof window === "undefined") return;
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script#nmi-collectjs",
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://paymentcloud.transactiongateway.com/token/Collect.js";
    script.async = true;
    // Use id, not data-* — CollectJS auto-parses every data-* on its
    // own script tag as a config key.
    script.id = "nmi-collectjs";
    script.setAttribute("data-tokenization-key", publicKey);
    // Required when the merchant has Apple Pay enabled at the gateway;
    // missing these triggers "Could not create
    // PaymentRequestAbstraction".
    script.setAttribute("data-price", "1.00");
    script.setAttribute("data-currency", "USD");
    script.setAttribute("data-country", "US");
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    script.addEventListener("error", () => {
      onErrorRef.current("Failed to load card form. Refresh and try again.");
    });
    document.body.appendChild(script);
  }, [publicKey]);

  useEffect(() => {
    if (!scriptReady || !window.CollectJS) return;
    // Match the official CollectJS React demo's shape exactly —
    // `paymentSelector` and `fieldsAvailableCallback` trip the JS-API
    // validator with "Unexpected fields for collectjs" despite being
    // documented as data-* attributes.
    // Inline styles applied INSIDE each CollectJS iframe. The iframes
    // are cross-origin so we can't reach in with our own CSS; CollectJS
    // copies these onto the input element it renders.
    // CollectJS iframes ignore some of our CSS (cross-origin security).
    // To stay readable in every state — default, autofilled, focused —
    // pick a colour pairing that's robust even if `background-color` is
    // dropped: dark text on a light bg works whether the iframe ends up
    // white (CollectJS default), yellow (browser autofill), or our own.
    const fieldCss = {
      color: "#111827",
      "-webkit-text-fill-color": "#111827",
      "background-color": "#ffffff",
      "font-size": "14px",
      "font-family":
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "0 4px",
    };
    const focusCss = {
      ...fieldCss,
      color: "#000000",
      "-webkit-text-fill-color": "#000000",
    };
    const invalidCss = {
      ...fieldCss,
      color: "#b91c1c",
      "-webkit-text-fill-color": "#b91c1c",
    };
    const placeholderCss = {
      ...fieldCss,
      color: "#6b7280",
      "-webkit-text-fill-color": "#6b7280",
    };

    window.CollectJS.configure({
      variant: "inline",
      // Don't sniff parent CSS — sniffing was producing transparent + white
      // text inside a transparent iframe = invisible CVV. Always pass
      // explicit customCss instead.
      styleSniffer: "false",
      fields: {
        ccnumber: {
          selector: "#nmi-ccnumber",
          placeholder: "Card number",
        },
        ccexp: {
          selector: "#nmi-ccexp",
          placeholder: "MM / YY",
        },
        cvv: {
          selector: "#nmi-cvv",
          placeholder: "CVV",
        },
      },
      customCss: fieldCss,
      focusCss,
      invalidCss,
      placeholderCss,
      callback: async (resp: CollectJsResponse) => {
        if (!resp?.token) {
          setIsProcessingRef.current(false);
          onErrorRef.current("Card tokenization failed. Try again.");
          return;
        }
        try {
          const b = billingRef.current;
          const r = await fetch(submitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentToken: resp.token,
              cardBrand: resp.card?.type ?? null,
              cardNumberMasked: resp.card?.number ?? null,
              cardExp: resp.card?.exp ?? null,
              billingFirstName: b.firstName,
              billingLastName: b.lastName,
              billingLine1: b.line1,
              billingLine2: b.line2 || undefined,
              billingCity: b.city,
              billingState: b.stateField,
              billingZip: b.zip,
              billingCountry: b.country,
            }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            setIsProcessingRef.current(false);
            onErrorRef.current(data?.error || "Card was declined.");
            return;
          }
          onSuccessRef.current(data.method?.id);
        } catch (e) {
          setIsProcessingRef.current(false);
          onErrorRef.current(
            e instanceof Error ? e.message : "Failed to save card.",
          );
        }
      },
    });
  }, [scriptReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      onError("Enter the cardholder's first and last name.");
      return;
    }
    if (
      !line1.trim() ||
      !city.trim() ||
      !stateField.trim() ||
      !zip.trim() ||
      !country.trim()
    ) {
      onError("Enter the full billing address.");
      return;
    }
    if (!scriptReady || !window.CollectJS) {
      onError("Card form is still loading — wait a moment.");
      return;
    }
    setIsProcessing(true);
    window.CollectJS.startPaymentRequest();
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30";
  const fieldHostClass =
    "h-11 rounded-lg border border-white/10 bg-black/40 px-3 flex items-center";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!scriptReady && !cardFormLoadFailed && (
        <p className="py-6 text-center text-sm text-paper/60">
          Loading card form…
        </p>
      )}

      {cardFormLoadFailed && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
          <p className="text-sm font-medium text-accent">
            Card form failed to load.
          </p>
          <p className="mt-1 text-xs text-paper/70">
            The PaymentCloud iframe didn&rsquo;t attach. Refresh the page or
            disable any extensions blocking third-party iframes.
          </p>
        </div>
      )}

      <div
        className={
          scriptReady && !cardFormLoadFailed ? "space-y-3" : "hidden"
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoComplete="cc-given-name"
            required
            className={inputClass}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            autoComplete="cc-family-name"
            required
            className={inputClass}
          />
        </div>

        <input
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Street address"
          autoComplete="billing address-line1"
          required
          className={inputClass}
        />
        <input
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          placeholder="Apt / suite (optional)"
          autoComplete="billing address-line2"
          className={inputClass}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            autoComplete="billing address-level2"
            required
            className={inputClass}
          />
          <input
            value={stateField}
            onChange={(e) => setStateField(e.target.value)}
            placeholder="State / region"
            autoComplete="billing address-level1"
            required
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="Postal code"
            autoComplete="billing postal-code"
            required
            className={inputClass}
          />
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="US"
            autoComplete="billing country"
            maxLength={2}
            required
            className={inputClass}
          />
        </div>

        <div id="nmi-ccnumber" className={fieldHostClass} />
        <div className="grid grid-cols-2 gap-3">
          <div id="nmi-ccexp" className={fieldHostClass} />
          <div id="nmi-cvv" className={fieldHostClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={!scriptReady || isProcessing}
        className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {isProcessing ? "Saving…" : "Save card"}
      </button>

      <p className="text-center text-xs text-paper/50">
        Card details are tokenized in your browser by PaymentCloud — they
        never touch our servers.
      </p>
    </form>
  );
}
