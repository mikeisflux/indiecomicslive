// Wraps SendGrid v3 mail/send. Used by the admin compose form to send
// an outbound email FROM `support@indiecomicslive.com` (or whatever
// AUTH_EMAIL_FROM is) TO the recipient list, with optional plain-text
// or HTML body and arbitrary attachments. Returns the SendGrid response
// status + body so the caller can render an error inline.

interface AttachmentInput {
  filename: string;
  content: string; // base64
  type?: string;
}

interface SendArgs {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: AttachmentInput[];
  replyTo?: string;
}

export async function sendEmailRich(
  args: SendArgs,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const apiKey = process.env.AUTH_SENDGRID_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, status: 0, error: "SendGrid not configured" };
  }

  type Personalization = {
    to: { email: string }[];
    cc?: { email: string }[];
    bcc?: { email: string }[];
  };
  const personalization: Personalization = {
    to: args.to.map((e) => ({ email: e })),
  };
  if (args.cc?.length) personalization.cc = args.cc.map((e) => ({ email: e }));
  if (args.bcc?.length) personalization.bcc = args.bcc.map((e) => ({ email: e }));

  const content: { type: string; value: string }[] = [];
  if (args.text) content.push({ type: "text/plain", value: args.text });
  if (args.html) content.push({ type: "text/html", value: args.html });
  if (content.length === 0) {
    content.push({ type: "text/plain", value: "" });
  }

  const body: Record<string, unknown> = {
    personalizations: [personalization],
    from: { email: from, name: "Indie Comics Live" },
    subject: args.subject,
    content,
  };
  if (args.replyTo) body.reply_to = { email: args.replyTo };
  if (args.attachments?.length) {
    body.attachments = args.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      type: a.type ?? "application/octet-stream",
      disposition: "attachment",
    }));
  }

  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => "");
    console.warn("[email/rich] SendGrid rejected", {
      status: r.status,
      body: errBody.slice(0, 500),
      to: args.to,
    });
    return { ok: false, status: r.status, error: errBody.slice(0, 400) };
  }
  return { ok: true, status: r.status };
}
