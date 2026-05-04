import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Use in a Server Component / Server Action where the user must be
// signed in AND have picked a handle. Redirects to the right next step
// otherwise.
export async function requireOnboardedUser(returnTo: string): Promise<{
  id: string;
  handle: string;
  email: string | null;
  name: string | null;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, handle: true, email: true, name: true },
  });

  if (!me) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }

  if (!me.handle) {
    redirect(`/onboarding/handle?next=${encodeURIComponent(returnTo)}`);
  }

  return {
    id: me.id,
    handle: me.handle,
    email: me.email,
    name: me.name,
  };
}
