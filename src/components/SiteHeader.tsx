import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountMenu, {
  type RecentOrder,
  type RecentShow,
} from "@/components/AccountMenu";

// Top nav for public pages. Reads the session server-side so the
// signed-in/out state is correct on every render. Logs the resolved
// state on every render so we have observability when something
// looks off.
export default async function SiteHeader() {
  const session = await auth();
  const me = session?.user ?? null;

  let isApprovedSeller = false;
  let userRow: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    handle: string | null;
  } | null = null;
  let recentOrders: RecentOrder[] = [];
  let recentShows: RecentShow[] = [];

  if (me?.id) {
    userRow = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        handle: true,
      },
    });

    if (me.role === "admin" || me.role === "super_admin") {
      isApprovedSeller = true;
    } else {
      const app = await prisma.sellerApplication.findUnique({
        where: { userId: me.id },
        select: { status: true },
      });
      isApprovedSeller = app?.status === "approved";
    }

    const [orders, shows] = await Promise.all([
      prisma.order.findMany({
        where: { buyerId: me.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          status: true,
          lot: { select: { title: true, imageUrl: true } },
        },
      }),
      isApprovedSeller
        ? prisma.show.findMany({
            where: { sellerId: me.id },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              title: true,
              status: true,
              coverImageUrl: true,
            },
          })
        : Promise.resolve([] as Array<{
            id: string;
            title: string;
            status: string;
            coverImageUrl: string | null;
          }>),
    ]);

    recentOrders = orders.map((o) => ({
      id: o.id,
      title: o.lot?.title ?? "(untitled lot)",
      status: o.status as unknown as string,
      thumbnailUrl: o.lot?.imageUrl ?? null,
    }));
    recentShows = shows.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status as unknown as string,
      coverImageUrl: s.coverImageUrl,
    }));
  }

  console.log("[SiteHeader]", {
    signedIn: !!me,
    email: me?.email ?? null,
    role: me?.role ?? null,
    isApprovedSeller,
    recentOrders: recentOrders.length,
    recentShows: recentShows.length,
  });

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-6">
      <Link href="/" className="text-lg font-bold tracking-tight">
        Indie Comics <span className="text-accent">Live</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {!isApprovedSeller && (
          <Link
            href="/sell"
            className="hidden rounded-full border border-white/10 px-3 py-1.5 sm:inline-block"
          >
            Sell
          </Link>
        )}
        {me && userRow ? (
          <>
            {(me.role === "admin" || me.role === "super_admin") && (
              <Link
                href="/admin"
                className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-accent"
              >
                Admin
              </Link>
            )}
            <AccountMenu
              user={{
                email: userRow.email,
                name: userRow.name,
                image: userRow.image,
                handle: userRow.handle,
              }}
              isApprovedSeller={isApprovedSeller}
              recentOrders={recentOrders}
              recentShows={recentShows}
              onSignOut={handleSignOut}
            />
          </>
        ) : (
          <Link
            href="/sign-in"
            className="rounded-full border border-white/10 px-3 py-1.5"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
