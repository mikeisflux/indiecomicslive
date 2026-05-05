import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { r2PresignedDownload } from "@/lib/r2";

export const runtime = "nodejs";

// Re-serve a previously-purchased shipping label as a redirect to a
// short-lived presigned R2 URL. Owner-gated.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      sellerId: true,
      labelR2Key: true,
      trackingNumber: true,
    },
  });
  if (!order || order.sellerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!order.labelR2Key) {
    return NextResponse.json({ error: "no_label" }, { status: 404 });
  }
  const url = await r2PresignedDownload({
    key: order.labelR2Key,
    filename: `label-${order.trackingNumber ?? id}.pdf`,
    expiresIn: 60 * 5,
  });
  return NextResponse.redirect(url, 302);
}
