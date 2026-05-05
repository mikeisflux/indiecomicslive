import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Top nav for public pages. Reads the session server-side so the
// signed-in/out state is correct on every render. Always log the
// resolved state — when "Sign in" appears for a signed-in user, the
// only signal we have is whether auth() saw their session here.
export default async function SiteHeader() {
  const session = await auth();
  const me = session?.user ?? null;

  // Only show the "Seller" link to actually-approved sellers (or to
  // admins, who can fly anywhere). Unapproved users would otherwise
  // click "Seller" and get bounced into the application flow.
  let isApprovedSeller = false;
  if (me?.id) {
    if (me.role === "admin" || me.role === "super_admin") {
      isApprovedSeller = true;
    } else {
      const app = await prisma.sellerApplication.findUnique({
        where: { userId: me.id },
        select: { status: true },
      });
      isApprovedSeller = app?.status === "approved";
    }
  }

  console.log("[SiteHeader]", {
    signedIn: !!me,
    email: me?.email ?? null,
    role: me?.role ?? null,
    isApprovedSeller,
  });

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-6">
      <Link href="/" className="text-lg font-bold tracking-tight">
        Indie Comics <span className="text-accent">Live</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {/* Marketing "Sell" link: only for visitors and signed-in
            non-sellers. Approved sellers go straight to their
            dashboard via the "Seller" pill below. */}
        {!isApprovedSeller && (
          <Link
            href="/sell"
            className="hidden rounded-full border border-white/10 px-3 py-1.5 sm:inline-block"
          >
            Sell
          </Link>
        )}
        {me ? (
          <>
            {(me.role === "admin" || me.role === "super_admin") && (
              <Link
                href="/admin"
                className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-accent"
              >
                Admin
              </Link>
            )}
            {isApprovedSeller && (
              <Link
                href="/seller"
                className="hidden rounded-full border border-white/10 px-3 py-1.5 sm:inline-block"
              >
                Seller
              </Link>
            )}
            <span className="hidden truncate text-paper/60 sm:inline">
              {me.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="rounded-full border border-white/10 px-3 py-1.5">
                Sign out
              </button>
            </form>
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
