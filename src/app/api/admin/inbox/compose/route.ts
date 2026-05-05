import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmailRich } from "@/lib/email-rich";
import { r2Key, r2PutObject } from "@/lib/r2";

export const runtime = "nodejs";

function splitAddresses(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /.+@.+\..+/.test(x));
}

export async function POST(req: Request) {
  const me = await getAdminUserOrNull();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }

  const to = splitAddresses(fd.get("to")?.toString() ?? "");
  const cc = splitAddresses(fd.get("cc")?.toString() ?? "");
  const bcc = splitAddresses(fd.get("bcc")?.toString() ?? "");
  const subject = (fd.get("subject")?.toString() ?? "").slice(0, 998).trim();
  const text = (fd.get("text")?.toString() ?? "").slice(0, 200_000);
  const replyTo = fd.get("replyTo")?.toString() || undefined;

  if (to.length === 0) {
    return NextResponse.json(
      { error: "to_required", message: "At least one valid To address is required." },
      { status: 400 },
    );
  }
  if (!subject && !text) {
    return NextResponse.json(
      { error: "empty", message: "Subject or body required." },
      { status: 400 },
    );
  }

  const attachmentFiles: File[] = [];
  for (const [k, v] of fd.entries()) {
    if (k === "attachments" && v instanceof File && v.size > 0) {
      attachmentFiles.push(v);
    }
  }
  // 25 MB cap per attachment, 30 MB total — SendGrid's hard limits.
  const totalBytes = attachmentFiles.reduce((s, f) => s + f.size, 0);
  if (attachmentFiles.some((f) => f.size > 25 * 1024 * 1024) || totalBytes > 30 * 1024 * 1024) {
    return NextResponse.json(
      { error: "attachment_too_large", message: "25 MB per file, 30 MB total." },
      { status: 400 },
    );
  }

  const sgAttachments: { filename: string; content: string; type?: string }[] = [];
  for (const file of attachmentFiles) {
    const buf = Buffer.from(await file.arrayBuffer());
    sgAttachments.push({
      filename: file.name || "attachment",
      content: buf.toString("base64"),
      type: file.type || "application/octet-stream",
    });
  }

  const send = await sendEmailRich({
    to, cc, bcc, subject, text, replyTo,
    attachments: sgAttachments,
  });

  if (!send.ok) {
    return NextResponse.json(
      { error: "send_failed", status: send.status, detail: send.error },
      { status: 502 },
    );
  }

  // Persist a 'sent' row + upload attachments to R2 so admins see it
  // alongside inbound mail and can re-download what they sent.
  const created = await prisma.inboundEmail.create({
    data: {
      direction: "outbound",
      fromEmail: process.env.AUTH_EMAIL_FROM ?? "",
      fromName: "Indie Comics Live",
      toEmail: to[0],
      ccEmails: cc,
      bccEmails: bcc,
      subject,
      text,
      readAt: new Date(),
    },
  });

  for (const file of attachmentFiles) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const key = r2Key([
        "emails",
        created.id,
        `${Date.now()}-${file.name || "attachment"}`,
      ]);
      await r2PutObject({ key, body: buf, contentType: file.type });
      await prisma.inboundEmailAttachment.create({
        data: {
          emailId: created.id,
          filename: file.name || "attachment",
          contentType: file.type || null,
          sizeBytes: buf.byteLength,
          r2Key: key,
        },
      });
    } catch (e) {
      console.warn("[inbox-compose] attachment archive failed", {
        filename: file.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logAudit({
    actorId: me.id,
    action: "inbox.compose",
    targetKind: "inbound_email",
    targetId: created.id,
    metadata: { to, cc, bcc, subject, attachments: attachmentFiles.length },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
