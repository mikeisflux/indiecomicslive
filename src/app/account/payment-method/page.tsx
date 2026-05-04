import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadNmiConfig } from "@/lib/nmi";
import PaymentMethodClient from "./PaymentMethodClient";

export const dynamic = "force-dynamic";

export default async function PaymentMethodPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const config = loadNmiConfig();
  if (!config?.publicKey) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10">
        <h1 className="mb-4 text-2xl font-bold">Payment method</h1>
        <p className="text-sm text-paper/60">
          PaymentCloud is not configured yet. Set <code>NMI_SECURITY_KEY</code>{" "}
          and <code>NMI_PUBLIC_KEY</code> and restart.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-10 pb-20">
      <h1 className="mb-1 text-2xl font-bold">Payment method</h1>
      <p className="mb-6 text-sm text-paper/60">
        Save a card to bid on lots. Auction wins charge automatically.
      </p>
      <PaymentMethodClient publicKey={config.publicKey} />
    </main>
  );
}
