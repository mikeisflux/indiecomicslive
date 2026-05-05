// Minimal SendGrid HTTP client for transactional notifications other
// than the Auth.js magic-link (which uses Auth.js's built-in SendGrid
// provider). One outbound surface, easy to swap providers later.

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  const apiKey = process.env.AUTH_SENDGRID_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] SendGrid not configured — message dropped", {
      to: args.to,
      subject: args.subject,
    });
    return false;
  }

  const body = {
    personalizations: [{ to: [{ email: args.to }] }],
    from: { email: from, name: "Indie Comics Live" },
    subject: args.subject,
    content: [
      { type: "text/plain", value: args.text },
      ...(args.html ? [{ type: "text/html", value: args.html }] : []),
    ],
  };

  try {
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
      console.warn("[email] SendGrid rejected", {
        status: r.status,
        body: errBody.slice(0, 400),
        to: args.to,
        subject: args.subject,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] SendGrid fetch failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    "https://indiecomicslive.com"
  );
}
