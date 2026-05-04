import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, shows } from "@/db";
import SellerControls from "./SellerControls";

export const dynamic = "force-dynamic";

export default async function SellerShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;
  const [show] = await db.select().from(shows).where(eq(shows.id, id));
  if (!show) notFound();
  if (show.sellerId !== session.user.id) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <h1 className="mb-1 text-2xl font-bold">{show.title}</h1>
      <p className="mb-6 text-xs text-paper/60">{show.status}</p>
      <SellerControls show={{ id: show.id, status: show.status }} />
    </main>
  );
}
