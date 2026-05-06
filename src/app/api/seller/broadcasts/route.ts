import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushToUser } from "@/lib/push";
import { sendEmailRich } from "@/lib/email-rich";

export const runtime = "nodejs";

// POST /api/seller/broadcasts — seller blasts a message to every
// follower. Fans out via push + email. Heavily rate-limited (one
// broadcast per seller per hour) so we don't become a spam vector.
const Body = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  url: z.string().url().max(500).optional(),
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://indiecomicslive.com";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Caller must have an approved seller record.
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { approved: true },
  });
  if (!seller?.approved) {
    return NextResponse.json({ error: "not_a_seller" }, { status: 403 });
  }

  const lastHour = await prisma.sellerBroadcast.findFirst({
    where: {
      sellerId: session.user.id,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (lastHour) {
    return NextResponse.json(
      { error: "rate_limited", message: "One broadcast per hour." },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, handle: true },
  });
  const sellerLabel = me?.name ?? `@${me?.handle ?? "seller"}`;
  const broadcast = await prisma.sellerBroadcast.create({
    data: {
      sellerId: session.user.id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      url: parsed.data.url,
    },
    select: { id: true },
  });

  const followers = await prisma.follow.findMany({
    where: { sellerId: session.user.id },
    select: {
      followerId: true,
      follower: {
        select: { email: true, emailUnsubscribedAt: true },
      },
    },
  });

  let pushed = 0;
  let emailed = 0;
  for (const f of followers) {
    pushToUser(f.followerId, {
      kind: "seller_broadcast",
      title: `${sellerLabel}: ${parsed.data.subject}`,
      body: parsed.data.body.slice(0, 200),
      url: parsed.data.url ?? `/shop/${me?.handle ?? ""}`,
    }).catch(() => {});
    pushed += 1;

    if (f.follower.email && !f.follower.emailUnsubscribedAt) {
      const html = `
        <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:24px">
          <div style="max-width:560px;margin:0 auto">
            <h1 style="font-size:18px;margin:0 0 12px">${parsed.data.subject}</h1>
            <p style="white-space:pre-wrap">${escapeHtml(parsed.data.body)}</p>
            ${
              parsed.data.url
                ? `<p style="margin-top:16px"><a href="${parsed.data.url}" style="color:#ff3366">Open →</a></p>`
                : ""
            }
            <p style="margin:24px 0 0;color:#888;font-size:12px">
              Sent because you follow ${sellerLabel} on Indie Comics Live.
              <a href="${SITE}/account/notifications" style="color:#aaa">Unsubscribe</a>
            </p>
          </div>
        </body>`;
      const text = `${parsed.data.body}${
        parsed.data.url ? `\n\n${parsed.data.url}` : ""
      }`;
      sendEmailRich({
        to: [f.follower.email],
        subject: `${sellerLabel}: ${parsed.data.subject}`,
        text,
        html,
      })
        .then(() => {
          emailed += 1;
        })
        .catch(() => {});
    }
  }

  await prisma.sellerBroadcast.update({
    where: { id: broadcast.id },
    data: { sentAt: new Date(), recipients: followers.length },
  });

  return NextResponse.json({
    ok: true,
    recipients: followers.length,
    pushed,
    emailed,
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
