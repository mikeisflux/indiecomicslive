import { requireOnboardedUser } from "@/lib/onboarding";
import { loadNmiConfig } from "@/lib/nmi";
import { getActiveProcessor, getDivinityCoinConfig } from "@/lib/divinitycoin";
import PaymentMethodClient from "./PaymentMethodClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment method — Indie Comics Live",
};

export default async function PaymentMethodPage() {
  await requireOnboardedUser("/account/payment-method");

  const processor = await getActiveProcessor();
  const nmiConfig = loadNmiConfig();
  const dcConfig = await getDivinityCoinConfig();

  // Block render if the active processor isn't actually configured.
  const blocking =
    processor === "nmi" && !nmiConfig?.publicKey
      ? "PaymentCloud is not configured. Set NMI_SECURITY_KEY + NMI_PUBLIC_KEY in env and restart, or switch the active processor in /admin/settings/payments."
      : processor === "divinitycoin" && !dcConfig
        ? "Divinity Payments is selected as the active processor but isn't configured. Open /admin/settings/payments to add the API key + webhook secret."
        : null;

  if (blocking) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10">
        <h1 className="mb-4 text-2xl font-bold">Payment method</h1>
        <p className="text-sm text-paper/60">{blocking}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-10 pb-20">
      <h1 className="mb-1 text-2xl font-bold">Payment method</h1>
      <p className="mb-6 text-sm text-paper/60">
        Save a card to bid on lots. Auction wins charge automatically.
      </p>
      <PaymentMethodClient
        publicKey={nmiConfig?.publicKey ?? null}
        processor={processor}
      />
    </main>
  );
}
