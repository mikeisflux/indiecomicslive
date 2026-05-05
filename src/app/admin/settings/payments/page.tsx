import { prisma } from "@/lib/prisma";
import PaymentsSettingsForm from "./PaymentsSettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payments — Admin",
  robots: { index: false, follow: false },
};

export default async function PaymentsSettingsPage() {
  const row = await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="mt-1 text-sm text-paper/60">
        Switch the live payment processor and configure DivinityCoin
        partner credentials. Changes take effect on the next request —
        no restart needed.
      </p>

      <PaymentsSettingsForm
        initial={{
          activeProcessor: row.activeProcessor as "nmi" | "divinitycoin",
          divinityCoinEnabled: row.divinityCoinEnabled,
          divinityCoinApiKey: row.divinityCoinApiKey,
          divinityCoinPublicKey: row.divinityCoinPublicKey,
          divinityCoinPrivateKey: row.divinityCoinPrivateKey,
          divinityCoinPartnerId: row.divinityCoinPartnerId,
          divinityCoinWebhookSecret: row.divinityCoinWebhookSecret,
          divinityCoinBaseUrl: row.divinityCoinBaseUrl,
        }}
      />
    </div>
  );
}
