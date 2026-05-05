import { prisma } from "@/lib/prisma";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compose — Admin",
  robots: { index: false, follow: false },
};

const FROM_ADDR = process.env.AUTH_EMAIL_FROM ?? "";

function stripSubjectPrefix(s: string, re: RegExp): string {
  return s.replace(re, "").trim();
}

function buildQuotedHtml(orig: {
  fromEmail: string;
  fromName: string | null;
  receivedAt: Date;
  text: string | null;
  html: string | null;
  subject: string;
}): string {
  const when = orig.receivedAt.toLocaleString();
  const who = orig.fromName
    ? `${orig.fromName} <${orig.fromEmail}>`
    : orig.fromEmail;
  const headerLine = `On ${when}, ${who} wrote:`;
  const body = orig.html
    ? orig.html
    : (orig.text ?? "")
        .split("\n")
        .map((l) => `&gt; ${escapeHtml(l)}`)
        .join("<br>");
  return `<p></p><p></p><p style="color:#888">${escapeHtml(headerLine)}</p><blockquote style="border-left:3px solid #555;margin:0;padding:0 0 0 1em;color:#aaa">${body}</blockquote>`;
}

function buildForwardHeaderHtml(orig: {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  ccEmails: string[];
  receivedAt: Date;
  subject: string;
  text: string | null;
  html: string | null;
}): string {
  const lines = [
    "---------- Forwarded message ----------",
    `From: ${orig.fromName ? `${orig.fromName} <${orig.fromEmail}>` : orig.fromEmail}`,
    `Date: ${orig.receivedAt.toLocaleString()}`,
    `Subject: ${orig.subject || "(no subject)"}`,
    `To: ${orig.toEmail}`,
  ];
  if (orig.ccEmails.length > 0) {
    lines.push(`Cc: ${orig.ccEmails.join(", ")}`);
  }
  const body = orig.html
    ? orig.html
    : (orig.text ?? "")
        .split("\n")
        .map((l) => escapeHtml(l))
        .join("<br>");
  return `<p></p><p></p><p style="color:#888">${lines.map((l) => escapeHtml(l)).join("<br>")}</p><div>${body}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{
    reply?: string;
    replyAll?: string;
    forward?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  let prefill = { to: "", cc: "", bcc: "", subject: "", html: "" };
  let replyToId: string | undefined;
  let forwardFromId: string | undefined;
  let mode: "new" | "reply" | "replyAll" | "forward" = "new";

  const sourceId = sp.reply || sp.replyAll || sp.forward;
  if (sourceId) {
    const orig = await prisma.inboundEmail.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        toEmail: true,
        ccEmails: true,
        subject: true,
        text: true,
        html: true,
        receivedAt: true,
        _count: { select: { attachments: true } },
      },
    });

    if (orig) {
      if (sp.reply) {
        mode = "reply";
        replyToId = orig.id;
        prefill.to = orig.fromEmail;
        prefill.subject = `Re: ${stripSubjectPrefix(orig.subject || "", /^(re:\s*)+/i)}`;
        prefill.html = buildQuotedHtml(orig);
      } else if (sp.replyAll) {
        mode = "replyAll";
        replyToId = orig.id;
        prefill.to = orig.fromEmail;
        // pull other recipients onto Cc, minus our own from-address
        const others = [orig.toEmail, ...orig.ccEmails].filter(
          (e) =>
            e &&
            e.toLowerCase() !== FROM_ADDR.toLowerCase() &&
            e.toLowerCase() !== orig.fromEmail.toLowerCase(),
        );
        prefill.cc = Array.from(new Set(others)).join(", ");
        prefill.subject = `Re: ${stripSubjectPrefix(orig.subject || "", /^(re:\s*)+/i)}`;
        prefill.html = buildQuotedHtml(orig);
      } else if (sp.forward) {
        mode = "forward";
        forwardFromId = orig.id;
        prefill.subject = `Fwd: ${stripSubjectPrefix(orig.subject || "", /^(fwd?:\s*)+/i)}`;
        prefill.html = buildForwardHeaderHtml(orig);
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {mode === "reply" || mode === "replyAll"
          ? "Reply"
          : mode === "forward"
            ? "Forward"
            : "New email"}
      </h1>
      <p className="mt-1 text-sm text-paper/60">
        Sends from{" "}
        <code className="rounded bg-black/40 px-1">{FROM_ADDR || "(unset)"}</code>{" "}
        via SendGrid. Comma- or semicolon-separate multiple addresses.
      </p>
      <ComposeForm
        prefill={prefill}
        replyToId={replyToId}
        forwardFromId={forwardFromId}
        mode={mode}
      />
    </div>
  );
}
