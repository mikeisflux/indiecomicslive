import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/account");
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      handle: true,
      bio: true,
      location: true,
      websites: true,
    },
  });
  if (!me) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/" className="text-sm text-paper/60 hover:text-paper">
        ← Home
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Profile</h1>
      <p className="mt-1 text-sm text-paper/60">
        How you appear on Indie Comics Live.
      </p>
      <AccountForm initial={me} />

      <div className="mt-10 grid gap-2 sm:grid-cols-2">
        <SubLink href="/account/payment-method" label="Payment method" />
        <SubLink href="/account/addresses" label="Shipping addresses" />
        <SubLink href="/account/notifications" label="Notifications" />
        <SubLink href="/account/following" label="Following" />
      </div>
    </main>
  );
}

function SubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm hover:bg-white/[0.04]"
    >
      <span>{label}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}
