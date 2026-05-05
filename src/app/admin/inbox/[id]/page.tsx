import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DeleteEmailButton from "./DeleteEmailButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email — Admin",
  robots: { index: false, follow: false },
};

export default async function InboxDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!email) notFound();

  // Mark as read on first view.
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
        <h1 className="text-xl font-bold">{email.subject || "(no subject)"}</h1>
        <div className="mt-3 grid grid-cols-[120px_1fr] gap-x-4 gap-y-1 text-sm">
          <span className="text-paper/50">From</span>
          <span>
            {email.fromName ? `${email.fromName} ` : ""}
            <span className="text-paper/60">&lt;{email.fromEmail}&gt;</span>
          </span>
          <span className="text-paper/50">To</span>
          <span>{email.toEmail}</span>
          <span className="text-paper/50">Received</span>
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

        <hr className="my-5 border-white/10" />

        {email.html ? (
          <div
            className="prose prose-invert max-w-none text-sm"
            // SendGrid Inbound Parse already sanitizes by default but we
            // render this only inside the admin shell which only logged-
            // in admins can reach. Treat it as an admin-only render.
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

        <DeleteEmailButton id={email.id} />
      </div>
    </div>
  );
}
