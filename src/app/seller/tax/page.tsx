import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaxForm from "./TaxForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Tax info — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function SellerTaxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/seller/tax");
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { approved: true },
  });
  if (!seller?.approved) redirect("/sell");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      taxFormType: true,
      taxFormSignedAt: true,
      taxAddressJson: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/seller" className="text-sm text-paper/60 hover:text-paper">
        ← Seller hub
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tax info</h1>
      <p className="mt-1 text-sm text-paper/60">
        Required before payouts run. We use this for the year-end 1099-K.
        Legal name + TIN are encrypted at rest. Update any time.
      </p>

      {me?.taxFormSignedAt && (
        <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {me.taxFormType ?? "Tax form"} on file ·{" "}
          signed {new Date(me.taxFormSignedAt).toLocaleDateString()}.
          Re-submit below if anything changed.
        </p>
      )}

      <TaxForm
        defaultType={(me?.taxFormType as "W9" | "W8" | null) ?? "W9"}
        defaultAddress={
          (me?.taxAddressJson as Record<string, string> | null) ?? null
        }
      />
    </main>
  );
}
