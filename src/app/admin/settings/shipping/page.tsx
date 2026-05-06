import { prisma } from "@/lib/prisma";
import ShippingSettingsForm from "./ShippingSettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shipping — Admin",
  robots: { index: false, follow: false },
};

export default async function ShippingSettingsPage() {
  const row = await prisma.platformSetting.findUnique({
    where: { id: "default" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Shipping (Shippo)</h1>
      <p className="mt-1 text-sm text-paper/60">
        One master Shippo account drives label purchase + tracking
        webhooks for every seller. Get the live API token from{" "}
        <a
          href="https://apps.goshippo.com/settings/api"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Shippo → Settings → API
        </a>
        . Connect carriers (USPS, UPS, FedEx, DHL) inside the same
        dashboard — they surface automatically in our rate quote.
      </p>

      <ShippingSettingsForm
        initial={{
          apiKeySet: !!row?.shippoApiKey,
          webhookSecretSet: !!row?.shippoWebhookSecret,
        }}
      />

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-paper/70">
        <p className="text-xs font-semibold uppercase tracking-widest text-paper/50">
          Webhook
        </p>
        <p className="mt-1">
          Configure in{" "}
          <a
            href="https://apps.goshippo.com/settings/api"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Shippo → Settings → API → Webhooks
          </a>
          .
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            <strong className="text-paper">Event:</strong> <code>track_updated</code>
          </li>
          <li>
            <strong className="text-paper">URL:</strong>{" "}
            <code>https://indiecomicslive.com/api/webhooks/shippo?token=&lt;your webhook secret&gt;</code>
          </li>
        </ul>
        <p className="mt-2 text-xs text-paper/50">
          When Shippo reports <code>tracking_status.status === &quot;DELIVERED&quot;</code> the
          matching Order auto-flips to <code>delivered</code> and becomes
          payout-eligible.
        </p>
      </div>
    </div>
  );
}
