import StreamingHealthPanel from "./StreamingHealthPanel";

export const metadata = { title: "Settings — Admin" };

// Settings is intentionally split:
// 1. Streaming health panel (live, client-fetched + refreshable)
// 2. Read-only env-config view
//
// To let admins rotate secrets without a redeploy later, store these
// in a PlatformSettings table and have lib/nmi.ts / lib/antmedia.ts /
// lib/turn.ts consult it before falling back to env.

export default function SettingsPage() {
  const sections: {
    title: string;
    items: { label: string; status: string; note?: string }[];
  }[] = [
    {
      title: "Payments (PaymentCloud / NMI)",
      items: [
        {
          label: "Gateway",
          status: process.env.NMI_SECURITY_KEY
            ? "configured (env)"
            : "not configured",
          note: "Set NMI_SECURITY_KEY, NMI_PUBLIC_KEY, NMI_WEBHOOK_SECRET, NMI_ENVIRONMENT.",
        },
        {
          label: "Gateway URL",
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
      title: "Streaming (Ant Media)",
      items: [
        {
          label: "Host",
          status: process.env.ANT_MEDIA_HOST ?? "not configured",
        },
        {
          label: "App",
          status: process.env.ANT_MEDIA_APP ?? "WebRTCAppEE",
        },
        {
          label: "JWT publish/play tokens",
          status: process.env.ANT_MEDIA_JWT_SECRET ? "enabled" : "missing",
          note: "Must match Ant Media's JWT Stream Security Settings panel.",
        },
        {
          label: "Stream webhook",
          status: process.env.ANT_MEDIA_WEBHOOK_SECRET ? "set" : "missing",
        },
        {
          label: "REST credentials",
          status:
            process.env.ANT_MEDIA_REST_USER && process.env.ANT_MEDIA_REST_PASS
              ? "set"
              : "missing",
          note: "Required for the version probe + getBroadcastStatus.",
        },
      ],
    },
    {
      title: "TURN (coturn)",
      items: [
        {
          label: "Host",
          status: process.env.TURN_HOST ?? "not configured",
          note: "Without TURN, ~10-15% of users behind symmetric NAT will fail.",
        },
        {
          label: "Ports",
          status: `${process.env.TURN_PORT ?? "3478"} (UDP+TCP) · ${process.env.TURN_TLS_PORT ?? "5349"} (TLS)`,
        },
        {
          label: "Realm",
          status: process.env.TURN_REALM ?? "(falls back to host)",
        },
        {
          label: "Shared secret",
          status: process.env.TURN_SHARED_SECRET ? "set" : "missing",
          note: "Must match coturn's static-auth-secret.",
        },
        {
          label: "Credential TTL",
          status: `${process.env.TURN_TTL_SECONDS ?? "21600"}s`,
        },
      ],
    },
    {
      title: "Storage (Cloudflare R2)",
      items: [
        {
          label: "Bucket",
          status: process.env.R2_BUCKET ?? "not configured",
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
      title: "Realtime (WebSocket)",
      items: [
        {
          label: "WS port",
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
      <p className="mb-6 text-sm text-paper/60">
        Live health for the streaming infrastructure plus a read-only view
        of env-driven configuration. To rotate keys without a redeploy,
        move secrets into a <code>PlatformSettings</code> table and have
        the loaders consult it before env.
      </p>

      <StreamingHealthPanel />

      <div className="mt-8 space-y-6">
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
                        it.status.includes("not configured") ||
                        it.status.includes("not set")
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
