import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import ShopLotManager from "./ShopLotManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "24/7 Shop — Seller",
};

export default async function SellerShopPage() {
  const me = await requireOnboardedUser("/seller/shop");

  const lots = await prisma.lot.findMany({
    where: {
      sellerId: me.id,
      showId: null,
      kind: { in: ["buy_now", "mystery"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Link href="/seller" className="text-sm text-paper/60 hover:text-paper">
            ← Seller
          </Link>
          <h1 className="mt-2 text-2xl font-bold">24/7 Shop</h1>
          <p className="mt-1 text-sm text-paper/60">
            Items listed here are purchasable any time from{" "}
            {me.handle ? (
              <Link
                href={`/shop/${me.handle}`}
                className="text-accent hover:underline"
              >
                /shop/{me.handle}
              </Link>
            ) : (
              <span className="text-paper/40">your shop</span>
            )}
            . No live show needed.
          </p>
        </div>
      </div>

      {!me.handle && (
        <p className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Set a handle in your{" "}
          <Link href="/account" className="underline">
            profile
          </Link>{" "}
          before listing — the public shop URL is built from it.
        </p>
      )}

      <ShopLotManager
        initialLots={lots.map((l) => ({
          id: l.id,
          kind: l.kind as "buy_now" | "mystery",
          title: l.title,
          imageUrl: l.imageUrl,
          buyNowCents: l.buyNowCents,
          inventoryCount: l.inventoryCount,
          status: l.status,
        }))}
      />
    </main>
  );
}
