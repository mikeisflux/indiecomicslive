import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
  description:
    "The adult-friendly Whatnot alternative. Live auctions for indie comics, NSFW art books, and trading cards. Sub-second WebRTC bidding, sellers keep more.",
  keywords: [
    "Whatnot alternative",
    "live comics auction",
    "NSFW comics",
    "adult comic auctions",
    "trading cards live auction",
    "indie comics",
    "live shopping",
  ],
  openGraph: {
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. The Whatnot alternative built from day one for NSFW-friendly creators.",
    type: "website",
    siteName: "Indie Comics Live",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indie Comics Live — Whatnot alternative for adult comics & cards",
    description:
      "Live auctions for adult comics, indie books, and trading cards. NSFW-friendly from day one.",
  },
};

async function getLiveAndUpcoming() {
  return await prisma.show.findMany({
    where: { status: { in: ["live", "scheduled"] } },
    take: 40,
    orderBy: [{ status: "desc" }, { scheduledFor: "desc" }],
    include: {
      seller: { select: { id: true, handle: true, name: true } },
    },
  });
}

export default async function Home() {
  const list = await getLiveAndUpcoming().catch(() => []);
  const live = list.filter((s) => s.status === "live");
  const upcoming = list.filter((s) => s.status === "scheduled");

  return (
    <main>
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:pt-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          A Whatnot alternative — for adult comics & cards
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
          Live auctions for indie comics,
          <br />
          adult-friendly art books, and trading cards.
        </h1>
        <p className="mt-4 max-w-2xl text-paper/70 sm:text-lg">
          The live-auction platform built from day one for NSFW-friendly
          creators. Sub-second WebRTC bidding, no app-store gatekeepers,
          no surprise bans, sellers keep more.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sell"
            className="rounded-full bg-accent px-5 py-3 text-sm font-bold text-white"
          >
            Start selling
          </Link>
          <Link
            href="#live"
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
          >
            Watch a show
          </Link>
        </div>
      </section>

      <section id="live" className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Live now
        </h2>
        {live.length === 0 ? (
          <p className="text-paper/50">
            No streams live right now. Check back soon — new shows kick off
            throughout the day.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((s) => (
              <ShowCard key={s.id} show={s} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-paper/60">
          Scheduled
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-paper/50">Nothing scheduled.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((s) => (
              <ShowCard key={s.id} show={s} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function ShowCard({
  show,
}: {
  show: {
    id: string;
    title: string;
    status: string;
    coverImageUrl: string | null;
    scheduledFor: Date | null;
    seller: { handle: string | null; name: string | null } | null;
  };
}) {
  return (
    <Link
      href={`/s/${show.id}`}
      className="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition hover:border-white/20"
    >
      <div className="relative aspect-video bg-black/60">
        {show.coverImageUrl ? (
          <Image
            src={show.coverImageUrl}
            alt={show.title}
            fill
            className="object-cover"
          />
        ) : null}
        {show.status === "live" && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase">
            Live
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-semibold">{show.title}</p>
        <p className="text-xs text-paper/60">
          @{show.seller?.handle ?? "unknown"}
          {show.scheduledFor && show.status === "scheduled"
            ? ` · ${new Date(show.scheduledFor).toLocaleString()}`
            : null}
        </p>
      </div>
    </Link>
  );
}
