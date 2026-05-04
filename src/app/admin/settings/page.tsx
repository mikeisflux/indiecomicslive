export const metadata = { title: "Settings — Admin" };

// Settings is intentionally a stub for MVP. The places we'd plug in
// real toggles are documented inline. Today everything reads from env;
// when you're ready to let admins rotate keys + toggle features without
// a redeploy, store these in a PlatformSettings table and wire the
// loaders in lib/nmi.ts / lib/antmedia.ts to consult it before env.

export default function SettingsPage() {
  const sections: {
    title: string;
    items: { label: string; status: string; note?: string }[];
  }[] = [
    {
      title: "Payments",
      items: [
        {
          label: "PaymentCloud (NMI) gateway",
          status: process.env.NMI_SECURITY_KEY
            ? "configured (env)"
            : "not configured",
          note: "Set NMI_SECURITY_KEY, NMI_PUBLIC_KEY, NMI_WEBHOOK_SECRET, NMI_ENVIRONMENT.",
        },
        {
          label: "NMI gateway URL",
          status:
            process.env.NMI_GATEWAY_URL ||
            "paymentcloud.transactiongateway.com (default)",
        },
        {
          label: "Bank-account encryption",
          status: process.env.BANK_ACCOUNT_ENCRYPTION_KEY
            ? "AES-256-GCM (env key)"
            : "missing",
          note: "BANK_ACCOUNT_ENCRYPTION_KEY must be 32 bytes base64.",
        },
      ],
    },
    {
      title: "Streaming",
      items: [
        {
          label: "Ant Media host",
          status: process.env.ANT_MEDIA_HOST ?? "not configured",
        },
        {
          label: "Ant Media app",
          status: process.env.ANT_MEDIA_APP ?? "WebRTCAppEE",
        },
        {
          label: "JWT publish/play tokens",
          status: process.env.ANT_MEDIA_JWT_SECRET
            ? "enabled"
            : "missing",
          note: "Must match Ant Media's JWT Stream Security Settings panel.",
        },
        {
          label: "Stream webhook signature",
          status: process.env.ANT_MEDIA_WEBHOOK_SECRET ? "set" : "missing",
        },
      ],
    },
    {
      title: "Storage",
      items: [
        {
          label: "Cloudflare R2",
          status: process.env.R2_BUCKET
            ? `bucket: ${process.env.R2_BUCKET}`
            : "not configured",
        },
        {
          label: "Public URL",
          status: process.env.R2_PUBLIC_URL ?? "not set",
        },
      ],
    },
    {
      title: "Auth",
      items: [
        {
          label: "Auth.js secret",
          status: process.env.AUTH_SECRET ? "set" : "missing",
        },
        {
          label: "Resend (magic link)",
          status: process.env.AUTH_RESEND_KEY ? "configured" : "not configured",
        },
        {
          label: "From address",
          status: process.env.AUTH_EMAIL_FROM ?? "not set",
        },
      ],
    },
    {
      title: "Realtime",
      items: [
        {
          label: "WebSocket port",
          status: process.env.WS_PORT ?? "3001 (default)",
        },
        {
          label: "Public WS URL",
          status: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001",
        },
      ],
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-8 text-sm text-paper/60">
        Read-only view of the running configuration. Today every setting
        comes from env. To rotate keys without a redeploy, move these into
        a <code>PlatformSettings</code> table and have <code>lib/nmi.ts</code>{" "}
        / <code>lib/antmedia.ts</code> consult it before falling back to
        env.
      </p>

      <div className="space-y-6">
        {sections.map((s) => (
          <section
            key={s.title}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60">
              {s.title}
            </h2>
            <dl className="space-y-3 text-sm">
              {s.items.map((it) => (
                <div
                  key={it.label}
                  className="grid grid-cols-[200px_1fr] items-baseline gap-3"
                >
                  <dt className="text-paper/60">{it.label}</dt>
                  <dd>
                    <p
                      className={
                        it.status.includes("missing") ||
                        it.status.includes("not")
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }
                    >
                      {it.status}
                    </p>
                    {it.note && (
                      <p className="mt-1 text-xs text-paper/50">{it.note}</p>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
