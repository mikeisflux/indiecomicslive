import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { searchLots } from "@/lib/search";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SaveSearchButton from "./SaveSearchButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search — Indie Comics Live",
  description: "Search lots across every seller on Indie Comics Live.",
  alternates: { canonical: "/search" },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const hits = q ? await searchLots(q, { limit: 60 }) : [];

  // Has the current user already saved this exact query?
  let alreadySaved = false;
  const session = await auth();
  if (q && session?.user?.id) {
    const existing = await prisma.savedSearch.findFirst({
      where: { userId: session.user.id, query: q },
      select: { id: true },
    });
    alreadySaved = !!existing;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">
        <form className="flex gap-2" action="/search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search lots — comics, art, cards…"
            className="flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm"
            autoFocus={!q}
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white"
          >
            Search
          </button>
        </form>

        {q && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-paper/60">
              {hits.length === 0 ? (
                "No matches."
              ) : (
                <>
                  {hits.length} result{hits.length === 1 ? "" : "s"} for{" "}
                  <span className="text-paper">&ldquo;{q}&rdquo;</span>
                </>
              )}
            </p>
            <SaveSearchButton query={q} alreadySaved={alreadySaved} />
          </div>
        )}

        {hits.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((l) => (
              <li
                key={l.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
              >
                <Link
                  href={
                    l.show
                      ? `/s/${l.show.id}`
                      : l.seller.handle
                        ? `/shop/${l.seller.handle}`
                        : "/"
                  }
                  className="block"
                >
                  <div className="relative aspect-square bg-black/40">
                    {l.imageUrl ? (
                      <Image
                        src={l.imageUrl}
                        alt={l.title}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                    {l.kind === "mystery" && (
                      <span className="absolute left-3 top-3 rounded-full bg-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                        Mystery
                      </span>
                    )}
                    {l.show && (
                      <span className="absolute left-3 bottom-3 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-paper">
                        In live show
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 font-semibold">{l.title}</p>
                    <p className="mt-1 text-xs text-paper/60">
                      {l.kind === "auction"
                        ? `Auction · start ${dollars(l.startingBidCents)}`
                        : `${dollars(l.buyNowCents ?? 0)}`}
                      {l.seller.handle ? ` · @${l.seller.handle}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
