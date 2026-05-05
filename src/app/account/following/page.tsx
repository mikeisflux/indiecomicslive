import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Following — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function FollowingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/following");

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        select: { id: true, name: true, handle: true, image: true },
      },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Profile
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Following</h1>
      <p className="mt-1 text-sm text-paper/60">
        Sellers you follow. Their live shows surface in your dashboard.
      </p>

      {follows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-paper/60">
          You aren&rsquo;t following anyone yet. Open a seller&rsquo;s page and
          hit Follow to start.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {follows.map((f) => (
            <li key={f.sellerId}>
              <Link
                href={`/seller/${f.seller.handle ?? f.seller.id}`}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.04]"
              >
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  {/* avatar placeholder; <Image> import skipped to keep this page light */}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {f.seller.name ?? f.seller.handle ?? "(seller)"}
                  </p>
                  {f.seller.handle && (
                    <p className="truncate text-xs text-paper/50">
                      @{f.seller.handle}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
