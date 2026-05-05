import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUserOrNull, logAudit } from "@/lib/admin";
import { sendEmailRich } from "@/lib/email-rich";
import { r2Key, r2PutObject, r2GetObject } from "@/lib/r2";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

function splitAddresses(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /.+@.+\..+/.test(x));
}

function extractMessageId(headersField: unknown): string | null {
  if (typeof headersField !== "string") return null;
  const m = headersField.match(/^message-id:\s*(<[^>]+>)/im);
  return m ? m[1].trim() : null;
}

function extractReferences(headersField: unknown): string | null {
  if (typeof headersField !== "string") return null;
  const m = headersField.match(/^references:\s*(.+)$/im);
  return m ? m[1].trim() : null;
}

const HOST_DOMAIN = (process.env.AUTH_EMAIL_FROM ?? "indiecomicslive.com")
  .split("@")
  .pop() || "indiecomicslive.com";

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
  const html = (fd.get("html")?.toString() ?? "").slice(0, 400_000) || undefined;
  const replyTo = fd.get("replyTo")?.toString() || undefined;
  const replyToId = fd.get("replyToId")?.toString() || undefined;
  const forwardFromId = fd.get("forwardFromId")?.toString() || undefined;

  if (to.length === 0) {
    return NextResponse.json(
      { error: "to_required", message: "At least one valid To address is required." },
      { status: 400 },
    );
  }
  if (!subject && !text && !html) {
    return NextResponse.json(
      { error: "empty", message: "Subject or body required." },
      { status: 400 },
    );
  }

  // User-attached files
  const userFiles: { name: string; type: string; buf: Buffer }[] = [];
  for (const [k, v] of fd.entries()) {
    if (k === "attachments" && v instanceof File && v.size > 0) {
      userFiles.push({
        name: v.name || "attachment",
        type: v.type || "application/octet-stream",
        buf: Buffer.from(await v.arrayBuffer()),
      });
    }
  }

  // Look up reply / forward source. We need it for:
  //   - In-Reply-To / References headers (threading)
  //   - Copying original attachments on forward
  let sourceMessageId: string | null = null;
  let sourceReferences: string | null = null;
  const forwardedAttachments: { name: string; type: string; buf: Buffer }[] = [];

  if (replyToId || forwardFromId) {
    const id = replyToId || forwardFromId!;
    const orig = await prisma.inboundEmail.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (orig) {
      const raw = (orig.raw ?? null) as Record<string, unknown> | null;
      if (raw) {
        sourceMessageId = extractMessageId(raw.headers) ?? null;
        sourceReferences = extractReferences(raw.headers) ?? null;
        // outbound rows we previously created store our generated id here
        if (!sourceMessageId && typeof raw.message_id === "string") {
          sourceMessageId = raw.message_id;
        }
      }

      if (forwardFromId && orig.attachments.length > 0) {
        for (const a of orig.attachments) {
          try {
            const buf = await r2GetObject({ key: a.r2Key });
            forwardedAttachments.push({
              name: a.filename,
              type: a.contentType ?? "application/octet-stream",
              buf,
            });
          } catch (e) {
            console.warn("[inbox-compose] forward attachment fetch failed", {
              filename: a.filename,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }
  }

  const allAttachments = [...userFiles, ...forwardedAttachments];

  // SendGrid limits: 25 MB per attachment, 30 MB total.
  const totalBytes = allAttachments.reduce((s, a) => s + a.buf.byteLength, 0);
  if (
    allAttachments.some((a) => a.buf.byteLength > 25 * 1024 * 1024) ||
    totalBytes > 30 * 1024 * 1024
  ) {
    return NextResponse.json(
      { error: "attachment_too_large", message: "25 MB per file, 30 MB total." },
      { status: 400 },
    );
  }

  const sgAttachments = allAttachments.map((a) => ({
    filename: a.name,
    content: a.buf.toString("base64"),
    type: a.type,
  }));

  // Generate a Message-ID for our outbound. Stored on the row's raw blob
  // and emitted as a custom header so future replies can be threaded.
  const ourMessageId = `<${randomUUID()}@${HOST_DOMAIN}>`;
  const headers: Record<string, string> = { "Message-ID": ourMessageId };
  if (sourceMessageId) {
    headers["In-Reply-To"] = sourceMessageId;
    headers["References"] = sourceReferences
      ? `${sourceReferences} ${sourceMessageId}`
      : sourceMessageId;
  }

  const send = await sendEmailRich({
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    replyTo,
    attachments: sgAttachments,
    headers,
  });

  if (!send.ok) {
    return NextResponse.json(
      { error: "send_failed", status: send.status, detail: send.error },
      { status: 502 },
    );
  }

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
      html: html ?? null,
      readAt: new Date(),
      raw: {
        message_id: ourMessageId,
        in_reply_to: sourceMessageId,
        references: headers.References ?? null,
        reply_to_id: replyToId ?? null,
        forward_from_id: forwardFromId ?? null,
      },
    },
  });

  for (const a of allAttachments) {
    try {
      const key = r2Key(["emails", created.id, `${Date.now()}-${a.name}`]);
      await r2PutObject({ key, body: a.buf, contentType: a.type });
      await prisma.inboundEmailAttachment.create({
        data: {
          emailId: created.id,
          filename: a.name,
          contentType: a.type,
          sizeBytes: a.buf.byteLength,
          r2Key: key,
        },
      });
    } catch (e) {
      console.warn("[inbox-compose] attachment archive failed", {
        filename: a.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logAudit({
    actorId: me.id,
    action: replyToId
      ? "inbox.reply"
      : forwardFromId
        ? "inbox.forward"
        : "inbox.compose",
    targetKind: "inbound_email",
    targetId: created.id,
    metadata: {
      to,
      cc,
      bcc,
      subject,
      attachments: allAttachments.length,
      replyToId,
      forwardFromId,
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
