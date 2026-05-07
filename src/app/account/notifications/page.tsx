import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationsForm from "./NotificationsForm";
import NotifPrefsPanel from "./NotifPrefsPanel";
import EnablePushButton from "@/components/EnablePushButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/sign-in?callbackUrl=/account/notifications");

  const [me, items] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailUnsubscribedAt: true,
        notifPrefs: true,
        phoneE164: true,
        smsOptInAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Buyer Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Notifications</h1>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Push (this device)
        </h2>
        <p className="mt-1 text-sm text-paper/70">
          Get instant pings on outbids, when sellers you follow go live,
          and when your saved searches match a new drop.
        </p>
        <div className="mt-3">
          <EnablePushButton />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Email
        </h2>
        <p className="mt-1 text-sm text-paper/70">
          Transactional email (sign-in, order, payout, security) is always
          sent. Marketing email is opt-in.
        </p>
        <NotificationsForm initialSubscribed={!me?.emailUnsubscribedAt} />
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          What we ping you about
        </h2>
        <p className="mt-1 text-sm text-paper/70">
          Pick which channels you want for each kind. Marketing email
          is governed by the toggle above — turning it off silences
          marketing email regardless of what&rsquo;s checked here.
        </p>
        <NotifPrefsPanel
          initialPrefs={
            (me?.notifPrefs ?? {}) as Parameters<
              typeof NotifPrefsPanel
            >[0]["initialPrefs"]
          }
          initialPhone={me?.phoneE164 ?? null}
          initialSmsOptIn={!!me?.smsOptInAt}
        />
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Recent activity
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-paper/50">
            Nothing yet — when something happens you&rsquo;ll see it here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {items.map((n) => (
              <li key={n.id} className="py-2.5">
                {n.url ? (
                  <Link
                    href={n.url}
                    className="block hover:text-paper"
                  >
                    <Row n={n} />
                  </Link>
                ) : (
                  <Row n={n} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Row({
  n,
}: {
  n: {
    title: string;
    body: string;
    readAt: Date | null;
    createdAt: Date;
  };
}) {
  return (
    <div className={n.readAt ? "" : "opacity-100"}>
      <p
        className={`text-sm font-semibold ${
          n.readAt ? "text-paper/70" : "text-paper"
        }`}
      >
        {n.title}
      </p>
      <p className="mt-0.5 text-xs text-paper/60">{n.body}</p>
      <p className="mt-0.5 text-[10px] text-paper/40">
        {new Date(n.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
