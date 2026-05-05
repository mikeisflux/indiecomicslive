import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import UserActions from "./UserActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "User — Admin" };

export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireAdmin();
  const { id } = await params;

  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      seller: true,
      sellerApplication: { select: { id: true, status: true } },
      bankAccount: {
        select: { bankNameDisplay: true, accountLastFour: true, isVerified: true },
      },
      chargebackCard: {
        select: { cardBrand: true, cardLastFour: true, expMonth: true, expYear: true },
      },
      _count: {
        select: {
          ordersAsBuyer: true,
          ordersAsSeller: true,
          shows: true,
          bids: true,
          chatMessages: true,
        },
      },
    },
  });
  if (!u) notFound();

  return (
    <div>
      <Link href="/admin/users" className="text-sm text-paper/60">
        ← All users
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {u.name ?? u.email}
            <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-xs text-paper/60">
              {u.role}
            </span>
          </h1>
          <p className="text-sm text-paper/60">
            {u.email}
            {u.handle ? ` · @${u.handle}` : ""} · joined{" "}
            {new Date(u.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Activity">
          <Field label="Bids placed" value={u._count.bids} />
          <Field label="Orders as buyer" value={u._count.ordersAsBuyer} />
          <Field label="Orders as seller" value={u._count.ordersAsSeller} />
          <Field label="Shows hosted" value={u._count.shows} />
          <Field label="Chat messages" value={u._count.chatMessages} />
        </Section>

        <Section title="Account state">
          <Field label="Email verified" value={u.emailVerified ? "Yes" : "No"} />
          <Field
            label="Locked"
            value={u.lockedAt ? new Date(u.lockedAt).toLocaleString() : "—"}
            warn={!!u.lockedAt}
          />
          {u.lockedReason && <Field label="Lock reason" value={u.lockedReason} />}
          <Field
            label="Banned"
            value={u.bannedAt ? new Date(u.bannedAt).toLocaleString() : "—"}
            warn={!!u.bannedAt}
          />
          <Field
            label="Chat banned"
            value={u.chatBannedAt ? new Date(u.chatBannedAt).toLocaleString() : "—"}
            warn={!!u.chatBannedAt}
          />
          <Field
            label="Mod soft-deleted"
            value={u.deletedAt ? new Date(u.deletedAt).toLocaleString() : "—"}
            warn={!!u.deletedAt}
          />
          <Field
            label="Self-deleted"
            value={
              u.accountDeletedAt
                ? new Date(u.accountDeletedAt).toLocaleString()
                : "—"
            }
            warn={!!u.accountDeletedAt}
          />
          <Field label="Last known IP" value={u.lastKnownIP ?? "—"} />
          <Field
            label="Failed logins"
            value={u.failedLoginAttempts}
            warn={u.failedLoginAttempts > 5}
          />
        </Section>

        {u.seller && (
          <Section title="Seller">
            <Field label="Store name" value={u.seller.storeName} />
            <Field
              label="Approved"
              value={u.seller.approved ? "Yes" : "No"}
            />
            {u.seller.approvedAt && (
              <Field
                label="Approved at"
                value={new Date(u.seller.approvedAt).toLocaleString()}
              />
            )}
          </Section>
        )}

        {u.sellerApplication && (
          <Section title="Application">
            <Field label="Status" value={u.sellerApplication.status} />
            <Link
              href={`/admin/seller-applications/${u.sellerApplication.id}`}
              className="text-sm text-accent"
            >
              Open application →
            </Link>
          </Section>
        )}

        {u.bankAccount && (
          <Section title="Bank account (encrypted)">
            <Field label="Bank" value={u.bankAccount.bankNameDisplay ?? "—"} />
            <Field
              label="Last 4"
              value={`••••${u.bankAccount.accountLastFour ?? "????"}`}
            />
            <Field
              label="Verified"
              value={u.bankAccount.isVerified ? "Yes" : "Pending"}
            />
          </Section>
        )}

        {u.chargebackCard && (
          <Section title="Chargeback card">
            <Field
              label="Card"
              value={`${u.chargebackCard.cardBrand ?? "Card"} ••••${u.chargebackCard.cardLastFour}`}
            />
            <Field
              label="Expires"
              value={`${String(u.chargebackCard.expMonth).padStart(2, "0")}/${u.chargebackCard.expYear}`}
            />
          </Section>
        )}
      </div>

      <div className="mt-8">
        <UserActions
          userId={u.id}
          state={{
            locked: !!u.lockedAt,
            banned: !!u.bannedAt,
            chatBanned: !!u.chatBannedAt,
            role: u.role,
            lastKnownIP: u.lastKnownIP,
          }}
          isSelf={u.id === me.id}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-paper/60">
        {title}
      </h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <span className="text-xs text-paper/50">{label}</span>
      <span className={warn ? "text-amber-300" : "text-paper/90"}>
        {value}
      </span>
    </div>
  );
}
