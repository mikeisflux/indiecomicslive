import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { r2PresignedDownload } from "@/lib/r2";

// GET /api/seller/shipments/[id]/label.pdf
// 302 redirects to a short-lived presigned R2 URL serving the cached
// label PDF. Mirrors /api/seller/orders/[id]/label.pdf for bundles.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: { id: true, sellerId: true, labelR2Key: true },
  });
  if (!shipment || shipment.sellerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!shipment.labelR2Key) {
    return NextResponse.json({ error: "no_label" }, { status: 404 });
  }
  const url = await r2PresignedDownload({
    key: shipment.labelR2Key,
    filename: `label-${id.slice(0, 8)}.pdf`,
    expiresIn: 60 * 5,
  });
  return NextResponse.redirect(url, 302);
}
