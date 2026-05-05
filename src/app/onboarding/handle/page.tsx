import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HandlePickerForm from "./HandlePickerForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pick your handle — Indie Comics Live",
  robots: { index: false },
};

export default async function HandleOnboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { handle: true },
  });

  const params = await searchParams;
  const next = params.next ?? "/";

  if (me?.handle) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Pick a handle</h1>
      <p className="mb-6 text-sm text-paper/60">
        This is how you&rsquo;ll show up in chat and on your seller page.
        Lowercase letters, numbers, and underscores only.
      </p>
      <HandlePickerForm next={next} />
    </main>
  );
}
