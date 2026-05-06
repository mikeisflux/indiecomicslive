import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shipping addresses — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/addresses");

  const addrs = await prisma.userAddress.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Buyer Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Shipping addresses</h1>
      <p className="mt-1 text-sm text-paper/60">
        Saved buyer-side addresses for orders. (Sellers' return address
        lives at <Link href="/seller/ship-from" className="text-accent hover:underline">/seller/ship-from</Link>.)
      </p>

      {addrs.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
          You haven&rsquo;t saved an address yet. The first time you place a
          winning bid we&rsquo;ll capture one and store it here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {addrs.map((a) => (
            <li key={a.id} className="px-5 py-3 text-sm">
              <p className="font-semibold">
                {a.label || "Address"}
                {a.isDefault && (
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                    Default
                  </span>
                )}
              </p>
              <p className="mt-1 text-paper/80">
                {a.fullName}
                <br />
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.state} {a.postalCode} {a.country}
                {a.phone ? <><br />{a.phone}</> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
