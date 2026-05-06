import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SavedSearchList from "./SavedSearchList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved searches — Indie Comics Live",
  robots: { index: false, follow: false },
};

export default async function SavedSearchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account/saved-searches");

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      query: true,
      lastEmailedAt: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/account" className="text-sm text-paper/60 hover:text-paper">
        ← Profile
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Saved searches</h1>
      <p className="mt-1 text-sm text-paper/60">
        We&rsquo;ll email you once a day when new lots match these. Save more
        from the{" "}
        <Link href="/search" className="text-accent hover:underline">
          search page
        </Link>
        .
      </p>

      <SavedSearchList
        initial={searches.map((s) => ({
          id: s.id,
          query: s.query,
          lastEmailedAt: s.lastEmailedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
