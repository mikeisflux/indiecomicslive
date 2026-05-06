import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MobileGoLive from "./MobileGoLive";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Go Live — Indie Comics Live",
  robots: { index: false, follow: false },
};

// Mobile-first WebRTC publisher. Optimized for portrait phones: full-
// viewport camera preview, big tap target to start, stop, and switch
// cameras. Reuses the same publish-token flow as the desktop hub.
export default async function MobileGoLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/sign-in?callbackUrl=/seller/${id}/go-live`);

  const show = await prisma.show.findUnique({
    where: { id },
    select: { id: true, title: true, sellerId: true, status: true },
  });
  if (!show) notFound();
  if (show.sellerId !== session.user.id) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (me?.role !== "admin" && me?.role !== "super_admin") {
      redirect(`/seller/${id}`);
    }
  }

  return (
    <main className="fixed inset-0 z-40 flex flex-col bg-black">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={`/seller/${id}`}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-paper backdrop-blur"
          aria-label="Close"
        >
          ✕
        </Link>
        <p className="line-clamp-1 px-3 text-xs font-bold uppercase tracking-[0.25em] text-paper/80">
          {show.title}
        </p>
        <div className="h-9 w-9" />
      </header>

      <MobileGoLive showId={show.id} />
    </main>
  );
}
