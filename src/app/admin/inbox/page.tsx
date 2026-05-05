import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox — Admin",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

export default async function AdminInbox({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = q
    ? {
        OR: [
          { fromEmail: { contains: q, mode: "insensitive" as const } },
          { toEmail: { contains: q, mode: "insensitive" as const } },
          { subject: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [emails, total, unread] = await Promise.all([
    prisma.inboundEmail.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        direction: true,
        fromEmail: true,
        fromName: true,
        toEmail: true,
        subject: true,
        spamScore: true,
        readAt: true,
        starred: true,
        archivedAt: true,
        receivedAt: true,
        _count: { select: { attachments: true } },
      },
    }),
    prisma.inboundEmail.count({ where }),
    prisma.inboundEmail.count({ where: { readAt: null, direction: "inbound" } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-paper/60">
            Email received + sent via SendGrid. {unread > 0 ? (
              <span className="font-semibold text-accent">{unread} unread.</span>
            ) : (
              <span>All caught up.</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="search subject / address"
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm"
            />
          </form>
          <RefreshButton />
          <Link
            href="/admin/inbox/compose"
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-ink"
          >
            + New email
          </Link>
        </div>
      </div>

      {emails.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-paper/60">
          No email yet. Configure SendGrid Inbound Parse to POST to
          <code className="mx-1 rounded bg-black/40 px-1">/api/webhooks/sendgrid-inbound</code>
          and add an MX record at the apex{" "}
          <code className="rounded bg-black/40 px-1">indiecomicslive.com → mx.sendgrid.net</code>.
          Send a test email to <em>anything</em>@indiecomicslive.com.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
          {emails.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/inbox/${m.id}`}
                className={`block px-5 py-3 text-sm hover:bg-white/[0.04] ${
                  m.readAt ? "" : "bg-accent/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 block h-2 w-2 shrink-0 rounded-full ${m.readAt ? "bg-paper/20" : "bg-accent"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate ${m.readAt ? "" : "font-semibold"}`}>
                        {(m.direction as unknown as string) === "outbound" && (
                          <span className="mr-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                            sent
                          </span>
                        )}
                        {m.starred && (
                          <span className="mr-1 text-amber-300" aria-label="starred">★</span>
                        )}
                        {m.fromName ? `${m.fromName} ` : ""}
                        <span className="text-paper/60">&lt;{m.fromEmail}&gt;</span>
                      </span>
                      <span className="shrink-0 text-xs text-paper/50">
                        {new Date(m.receivedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="truncate text-paper/80">{m.subject || "(no subject)"}</div>
                    <div className="mt-0.5 flex gap-3 text-xs text-paper/50">
                      <span>to {m.toEmail}</span>
                      {m._count.attachments > 0 && (
                        <span title="Has attachments">📎 {m._count.attachments}</span>
                      )}
                      {m.spamScore !== null && (
                        <span
                          className={
                            m.spamScore >= 5
                              ? "text-red-300"
                              : m.spamScore >= 2
                                ? "text-amber-300"
                                : "text-paper/40"
                          }
                        >
                          spam {m.spamScore.toFixed(1)}
                        </span>
                      )}
                      {m.archivedAt && (
                        <span className="text-paper/40">archived</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-xs text-paper/60">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page - 1}`}
                className="rounded-full border border-white/10 px-3 py-1"
              >
                Prev
              </Link>
            )}
            {page * PAGE_SIZE < total && (
              <Link
                href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page + 1}`}
                className="rounded-full border border-white/10 px-3 py-1"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
