import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

// SendGrid Inbound Parse webhook. SendGrid POSTs a multipart/form-data
// body for every email it receives at the host(s) configured in
// Settings → Inbound Parse. Fields we care about: from, to, subject,
// text, html, spam_score, charsets. Attachments are skipped for now.
//
// Configure SendGrid:
//   1. DNS: MX record for `mail.indiecomicslive.com` → `mx.sendgrid.net.`
//      priority 10. (Use any subdomain you don't need for outbound,
//      e.g. `mail`, `inbound`, etc.)
//   2. SendGrid → Settings → Inbound Parse → Add Host & URL
//      Host: mail.indiecomicslive.com
//      URL:  https://indiecomicslive.com/api/webhooks/sendgrid-inbound
//      POST the raw, full MIME message: leave OFF (we want parsed)
//      Check spam: ON
// Test from any external email by sending to anything@mail.indiecomicslive.com.

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
  const fd = await req.formData().catch(() => null);
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

  await prisma.inboundEmail.create({
    data: {
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

  return NextResponse.json({ ok: true });
}
