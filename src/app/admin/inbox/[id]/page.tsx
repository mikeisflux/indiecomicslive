import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmailActions from "./EmailActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email — Admin",
  robots: { index: false, follow: false },
};

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function InboxDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = await prisma.inboundEmail.findUnique({
    where: { id },
    include: {
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          filename: true,
          contentType: true,
          sizeBytes: true,
        },
      },
    },
  });
  if (!email) notFound();

  if (!email.readAt) {
    await prisma.inboundEmail.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  return (
    <div>
      <Link
        href="/admin/inbox"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Inbox
      </Link>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">{email.subject || "(no subject)"}</h1>
          {(email.direction as unknown as string) === "outbound" && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              sent
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-[120px_1fr] gap-x-4 gap-y-1 text-sm">
          <span className="text-paper/50">From</span>
          <span>
            {email.fromName ? `${email.fromName} ` : ""}
            <span className="text-paper/60">&lt;{email.fromEmail}&gt;</span>
          </span>
          <span className="text-paper/50">To</span>
          <span>{email.toEmail}</span>
          {email.ccEmails.length > 0 && (
            <>
              <span className="text-paper/50">Cc</span>
              <span>{email.ccEmails.join(", ")}</span>
            </>
          )}
          {email.bccEmails.length > 0 && (
            <>
              <span className="text-paper/50">Bcc</span>
              <span>{email.bccEmails.join(", ")}</span>
            </>
          )}
          <span className="text-paper/50">
            {(email.direction as unknown as string) === "outbound" ? "Sent" : "Received"}
          </span>
          <span>{new Date(email.receivedAt).toLocaleString()}</span>
          {email.spamScore !== null && (
            <>
              <span className="text-paper/50">Spam score</span>
              <span
                className={
                  email.spamScore >= 5
                    ? "text-red-300"
                    : email.spamScore >= 2
                      ? "text-amber-300"
                      : "text-paper"
                }
              >
                {email.spamScore.toFixed(2)}
              </span>
            </>
          )}
        </div>

        {email.attachments.length > 0 && (
          <>
            <hr className="my-5 border-white/10" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
              Attachments
            </h2>
            <ul className="mt-3 space-y-2">
              {email.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.filename}</p>
                    <p className="text-xs text-paper/50">
                      {a.contentType ?? "application/octet-stream"} · {bytes(a.sizeBytes)}
                    </p>
                  </div>
                  <a
                    href={`/api/admin/inbox/${email.id}/attachments/${a.id}`}
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/15"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        <hr className="my-5 border-white/10" />

        {email.html ? (
          <div
            className="prose prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: email.html }}
          />
        ) : email.text ? (
          <pre className="whitespace-pre-wrap text-sm text-paper/90">
            {email.text}
          </pre>
        ) : (
          <p className="text-sm text-paper/40">(empty body)</p>
        )}

        <hr className="my-5 border-white/10" />

        <EmailActions
          id={email.id}
          initial={{
            starred: email.starred,
            archived: !!email.archivedAt,
            read: !!email.readAt,
          }}
        />
      </div>
    </div>
  );
}
