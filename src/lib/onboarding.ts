import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Use in a Server Component / Server Action where the user must be
// signed in. Returns the user — `handle` may be null. We deliberately
// do NOT redirect to /onboarding/handle here: a handle is only needed
// for public profile URLs (e.g. /seller/@yourhandle), not to use the
// authenticated dashboards. Pages that need a handle can prompt for
// one inline.
export async function requireOnboardedUser(returnTo: string): Promise<{
  id: string;
  handle: string | null;
  email: string | null;
  name: string | null;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, handle: true, email: true, name: true },
  });

  if (!me) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  return {
    id: me.id,
    handle: me.handle,
    email: me.email,
    name: me.name,
  };
}
