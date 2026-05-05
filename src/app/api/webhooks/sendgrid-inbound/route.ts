import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { r2Key, r2PutObject } from "@/lib/r2";

// SendGrid Inbound Parse webhook. SendGrid POSTs a multipart/form-data
// body for every email it receives at the host(s) configured in
// Settings → Inbound Parse. Fields we care about: from, to, subject,
// text, html, spam_score, charsets. Attachments are skipped for now.
//
// Configure SendGrid (apex setup, what we actually run):
//   1. DNS: MX record at the apex `indiecomicslive.com` → `mx.sendgrid.net.`
//      priority 10. SPF TXT: `v=spf1 include:sendgrid.net ~all`.
//   2. SendGrid → Settings → Inbound Parse → Add Host & URL
//      Subdomain: (blank — use apex)
//      Domain:    indiecomicslive.com
//      URL:       https://indiecomicslive.com/api/webhooks/sendgrid-inbound
//      POST raw MIME: OFF (we want parsed)
//      Check spam: ON
// Test from any external email by sending to anything@indiecomicslive.com.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseAddress(s: string | null): { email: string; name: string | null } {
  if (!s) return { email: "", name: null };
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  }
  return { email: s.trim().toLowerCase(), name: null };
}

export async function POST(req: Request) {
  // SendGrid only POSTs from a small set of egress IPs. We don't gate
  // on those here because our outer nginx already has a rate limit
  // and the route is read-only-write — at worst someone sprays junk
  // emails into /admin/inbox which is admin-only anyway.
  console.log("[sendgrid-inbound] hit", {
    ct: req.headers.get("content-type"),
    cl: req.headers.get("content-length"),
    ua: req.headers.get("user-agent"),
  });
  const fd = await req.formData().catch((e) => {
    console.warn("[sendgrid-inbound] formData parse failed", e);
    return null;
  });
  if (!fd) {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }

  const from = parseAddress(fd.get("from")?.toString() ?? "");
  const to = parseAddress(fd.get("to")?.toString() ?? "");
  const subject = (fd.get("subject")?.toString() ?? "").slice(0, 998);
  const text = fd.get("text")?.toString() ?? null;
  const html = fd.get("html")?.toString() ?? null;
  const spamRaw = fd.get("spam_score")?.toString();
  const spamScore = spamRaw ? Number(spamRaw) : null;

  // Stash a slim "raw" record of the headers + envelope so we can
  // debug routing later. Skip attachments (could be large).
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k === "attachments" || /^attachment\d+/.test(k)) continue;
    if (typeof v === "string") raw[k] = v.slice(0, 5000);
  }

  // Collect attachments. SendGrid sends them as fields named
  // attachment1, attachment2, ... (File entries). Upload each to R2
  // and create a DB row.
  const attachmentFiles: File[] = [];
  for (const [k, v] of fd.entries()) {
    if (/^attachment\d+$/.test(k) && v instanceof File && v.size > 0) {
      attachmentFiles.push(v);
    }
  }

  console.log("[sendgrid-inbound] parsed", {
    from: from.email,
    to: to.email,
    subject: subject.slice(0, 80),
    spamScore,
    attachments: 0, // counted below before we await the upload
  });

  const created = await prisma.inboundEmail.create({
    data: {
      direction: "inbound",
      fromEmail: from.email,
      fromName: from.name,
      toEmail: to.email,
      subject,
      text,
      html,
      spamScore: Number.isFinite(spamScore) ? spamScore : null,
      raw: raw as Prisma.InputJsonValue,
    },
  });
  console.log("[sendgrid-inbound] saved", { id: created.id, to: to.email });

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
      console.warn("[sendgrid-inbound] attachment upload failed", {
        filename: file.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, id: created.id });
}
