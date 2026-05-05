import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Where to send a user immediately after sign-in / sign-up / password
// reset. Approved sellers → /seller, admins → /admin, everyone else
// (i.e. buyers) → /orders. Sign-in form sets redirectTo here when no
// explicit callbackUrl is provided.
//
// Safe-fallback: if anything goes wrong looking up the user, fall
// back to the homepage rather than throwing.
export default async function PostSignIn({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  // If the original sign-in had an explicit callback (e.g. user got
  // bounced from a deep link), honor it.
  if (sp.callbackUrl && sp.callbackUrl.startsWith("/")) {
    redirect(sp.callbackUrl);
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  if (session.user.role === "admin" || session.user.role === "super_admin") {
    redirect("/admin");
  }

  const app = await prisma.sellerApplication
    .findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    })
    .catch(() => null);

  if (app?.status === "approved") {
    redirect("/seller");
  }

  redirect("/orders");
}
