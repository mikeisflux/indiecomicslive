import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull } from "@/lib/admin";
import { r2PresignedDownload } from "@/lib/r2";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; attachmentId: string }>;
  },
) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, attachmentId } = await params;
  const att = await prisma.inboundEmailAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!att || att.emailId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = await r2PresignedDownload({
    key: att.r2Key,
    filename: att.filename,
    expiresIn: 60 * 5,
  });
  // Redirect — browser follows straight to R2 with the disposition
  // header so the file downloads with its original name.
  return NextResponse.redirect(url, 302);
}
