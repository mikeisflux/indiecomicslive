import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationsForm from "./NotificationsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/notifications");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailUnsubscribedAt: true },
  });
  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Profile
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-paper/60">
        Transactional email (sign-in, order, payout, security) is always sent.
        Marketing email is opt-in.
      </p>
      <NotificationsForm initialSubscribed={!me?.emailUnsubscribedAt} />
    </main>
  );
}
