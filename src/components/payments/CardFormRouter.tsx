"use client";

import { NmiCardForm } from "./NmiCardForm";
import { DcCardForm } from "./DcCardForm";

// Picks the right card-collection UI for the platform's active
// processor. Caller passes:
//   processor       - "nmi" | "divinitycoin"
//   nmiPublicKey    - CollectJS tokenization key (only used if NMI)
//   nmiSubmitUrl    - server route to POST the NMI token to
//                     (default = /api/payment-methods)
//   dcIntentUrl     - server route that mints the DC SetupIntent
//                     (default = /api/payment-methods/dc/intent)
//   dcConfirmUrl    - server route that persists the DC payment method
//                     (default = /api/payment-methods/dc/confirm)
//
// onSuccess / onError fire with the same shape regardless of processor
// so the calling form (e.g. seller chargeback step) is processor-blind.

type Props = {
  processor: "nmi" | "divinitycoin";
  nmiPublicKey: string | null;
  nmiSubmitUrl?: string;
  dcIntentUrl?: string;
  dcConfirmUrl?: string;
  onSuccess: (id: string) => void;
  onError: (message: string) => void;
};

export function CardFormRouter({
  processor,
  nmiPublicKey,
  nmiSubmitUrl,
  dcIntentUrl,
  dcConfirmUrl,
  onSuccess,
  onError,
}: Props) {
  if (processor === "divinitycoin") {
    return (
      <DcCardForm
        intentUrl={dcIntentUrl}
        confirmUrl={dcConfirmUrl}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }
  if (!nmiPublicKey) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
        PaymentCloud public key isn&rsquo;t set. Configure NMI_PUBLIC_KEY in
        the env or switch the active processor in /admin/settings/payments.
      </p>
    );
  }
  return (
    <NmiCardForm
      publicKey={nmiPublicKey}
      submitUrl={nmiSubmitUrl}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}
