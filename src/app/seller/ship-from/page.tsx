import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import ShipFromForm from "./ShipFromForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Return address — Seller",
};

export default async function ShipFromPage() {
  const me = await requireOnboardedUser("/seller/ship-from");
  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { shipFromAddress: true },
  });
  const initial = (meRow?.shipFromAddress ?? null) as
    | Record<string, string>
    | null;

  return (
    <main className="mx-auto max-w-xl px-4 pb-20 pt-8">
      <Link href="/seller" className="text-sm text-paper/60 hover:text-paper">
        ← Seller Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Return address</h1>
      <p className="mt-1 text-sm text-paper/60">
        Your packages ship from this address. Required before printing
        labels. Saved on your account; you can change it anytime.
      </p>
      <ShipFromForm initial={initial} />
    </main>
  );
}
