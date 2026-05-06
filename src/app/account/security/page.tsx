import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TwoFactorPanel from "./TwoFactorPanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Security — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/security");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      totpEnabledAt: true,
      totpBackupCodesHashed: true,
    },
  });
  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Buyer Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Security</h1>
      <p className="mt-1 text-sm text-paper/60">
        Two-factor authentication adds a one-time code from your phone to
        every sign-in. Strongly recommended if you sell — payouts move
        through here.
      </p>

      <TwoFactorPanel
        enrolled={!!me?.totpEnabledAt}
        backupCodesRemaining={me?.totpBackupCodesHashed.length ?? 0}
      />
    </main>
  );
}
