import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application — Admin",
};

export default async function SellerApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await prisma.sellerApplication.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          createdAt: true,
          bankAccount: {
            select: {
              bankNameDisplay: true,
              accountLastFour: true,
              accountType: true,
              isVerified: true,
            },
          },
          chargebackCard: {
            select: {
              cardBrand: true,
              cardLastFour: true,
              expMonth: true,
              expYear: true,
            },
          },
        },
      },
    },
  });
  if (!app) notFound();

  return (
    <div>
      <Link
        href="/admin/seller-applications"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← All applications
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{app.storeName}</h1>
          <p className="text-sm text-paper/60">
            {app.legalFirstName} {app.legalLastName} · {app.user.email}
            {app.user.handle ? ` · @${app.user.handle}` : ""}
          </p>
        </div>
        <Status status={app.status} />
      </div>

      {app.rejectionReason && (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-semibold">Rejected</p>
          <p className="mt-1">{app.rejectionReason.replace(/_/g, " ")}</p>
          {app.reviewerNotes && (
            <p className="mt-2 text-xs text-red-200/80">
              {app.reviewerNotes}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Identity">
          <Field label="Legal name" value={`${app.legalFirstName} ${app.legalLastName}`} />
          <Field
            label="DOB"
            value={new Date(app.dateOfBirth).toLocaleDateString()}
          />
          <Field label="Phone" value={app.phone} />
          <Field
            label="Address"
            value={
              <>
                {app.addressLine1}
                {app.addressLine2 ? `, ${app.addressLine2}` : ""}
                <br />
                {app.addressCity}, {app.addressState} {app.addressZip}
                <br />
                {app.addressCountry}
              </>
            }
          />
        </Section>

        <Section title="Business">
          <Field label="Store name" value={app.storeName} />
          <Field
            label="Store bio"
            value={<p className="whitespace-pre-wrap">{app.storeBio}</p>}
          />
          <Field
            label="Categories"
            value={
              <div className="flex flex-wrap gap-1">
                {app.contentCategories.length === 0 ? (
                  <span className="text-paper/40">none</span>
                ) : (
                  app.contentCategories.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-white/10 px-2 py-0.5 text-xs"
                    >
                      {c}
                    </span>
                  ))
                )}
              </div>
            }
          />
          <Field
            label="Will list NSFW?"
            value={app.willListAdult ? "Yes" : "No"}
          />
          {app.businessFilingState && (
            <Field
              label="Business filing"
              value={
                <>
                  {app.businessFilingState}{" "}
                  {app.businessFilingNumber
                    ? `· #${app.businessFilingNumber}`
                    : ""}
                  {app.businessFilingUrl ? (
                    <>
                      {" · "}
                      <a
                        href={app.businessFilingUrl}
                        target="_blank"
                        className="text-accent"
                      >
                        link
                      </a>
                    </>
                  ) : null}
                </>
              }
            />
          )}
          {app.taxIdLast4 && (
            <Field label="Tax ID (last 4)" value={`••••${app.taxIdLast4}`} />
          )}
        </Section>

        <Section title="Online presence">
          {app.primaryWebsite && (
            <Field
              label="Website"
              value={
                <a
                  href={app.primaryWebsite}
                  target="_blank"
                  className="text-accent"
                >
                  {app.primaryWebsite}
                </a>
              }
            />
          )}
          <SocialLinks links={app.socialLinks} />
        </Section>

        <Section title="Prior platforms">
          <Field
            label="Unfulfilled count"
            value={app.unfulfilledCount}
            warn={app.unfulfilledCount >= 3}
          />
          <Field
            label="1+ year past delivery?"
            value={app.pastDeliveryIssues ? "Yes" : "No"}
            warn={app.pastDeliveryIssues}
          />
          <PriorPlatforms platforms={app.priorPlatforms} />
        </Section>

        <Section title="Payouts (PaymentCloud bank)">
          {app.user.bankAccount ? (
            <>
              <Field
                label="Bank"
                value={app.user.bankAccount.bankNameDisplay ?? "—"}
              />
              <Field
                label="Account"
                value={`••••${app.user.bankAccount.accountLastFour ?? "????"} (${app.user.bankAccount.accountType})`}
              />
              <Field
                label="Verified"
                value={app.user.bankAccount.isVerified ? "Yes" : "Pending"}
              />
            </>
          ) : (
            <p className="text-sm text-amber-300">
              No bank account on file. Applicant cannot receive payouts.
            </p>
          )}
        </Section>

        <Section title="Chargeback recovery card">
          {app.user.chargebackCard ? (
            <>
              <Field
                label="Card"
                value={`${app.user.chargebackCard.cardBrand ?? "Card"} ••••${app.user.chargebackCard.cardLastFour}`}
              />
              <Field
                label="Expires"
                value={`${String(app.user.chargebackCard.expMonth).padStart(2, "0")}/${app.user.chargebackCard.expYear}`}
              />
            </>
          ) : (
            <p className="text-sm text-amber-300">
              No chargeback card on file. PaymentCloud requires this before
              approval.
            </p>
          )}
        </Section>

        <Section title="Agreements">
          <Field
            label="Seller agreement signed"
            value={
              app.agreedToSellerAgreementAt
                ? new Date(app.agreedToSellerAgreementAt).toLocaleString()
                : "—"
            }
          />
          <Field
            label="Content policy signed"
            value={
              app.agreedToContentPolicyAt
                ? new Date(app.agreedToContentPolicyAt).toLocaleString()
                : "—"
            }
          />
          {app.willListAdult && (
            <Field
              label="NSFW policy signed"
              value={
                app.agreedToNsfwPolicyAt
                  ? new Date(app.agreedToNsfwPolicyAt).toLocaleString()
                  : "—"
              }
            />
          )}
          <Field
            label="Agreement version"
            value={app.agreementVersion ?? "—"}
          />
        </Section>

        <Section title="Review">
          <Field
            label="Submitted"
            value={
              app.submittedAt
                ? new Date(app.submittedAt).toLocaleString()
                : "—"
            }
          />
          {app.reviewedAt && (
            <Field
              label="Reviewed"
              value={new Date(app.reviewedAt).toLocaleString()}
            />
          )}
          {app.reviewerNotes && (
            <Field
              label="Reviewer notes"
              value={
                <p className="whitespace-pre-wrap">{app.reviewerNotes}</p>
              }
            />
          )}
        </Section>
      </div>

      {(app.status === "submitted" || app.status === "under_review") && (
        <div className="mt-8">
          <ReviewActions applicationId={app.id} />
        </div>
      )}
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
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-xs text-paper/50">{label}</span>
      <span className={warn ? "text-amber-300" : "text-paper/90"}>
        {value}
      </span>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "rejected"
        ? "border-red-500/40 bg-red-500/10 text-red-300"
        : status === "under_review"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-accent/40 bg-accent/10 text-accent";
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${tone}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SocialLinks({ links }: { links: unknown }) {
  if (!links || typeof links !== "object") {
    return (
      <Field label="Social links" value={<span className="text-paper/40">none</span>} />
    );
  }
  const entries = Object.entries(links as Record<string, unknown>).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  ) as [string, string][];
  if (entries.length === 0) {
    return (
      <Field label="Social links" value={<span className="text-paper/40">none</span>} />
    );
  }
  return (
    <Field
      label="Social links"
      value={
        <ul className="space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="text-xs">
              <span className="text-paper/50">{k}:</span>{" "}
              <a href={v} target="_blank" className="text-accent">
                {v}
              </a>
            </li>
          ))}
        </ul>
      }
    />
  );
}

function PriorPlatforms({ platforms }: { platforms: unknown }) {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return (
      <Field
        label="Platforms"
        value={<span className="text-paper/40">none reported</span>}
      />
    );
  }
  return (
    <Field
      label="Platforms"
      value={
        <ul className="space-y-2">
          {(platforms as Array<Record<string, unknown>>).map((p, i) => (
            <li key={i} className="rounded-lg border border-white/10 p-2 text-xs">
              <p className="font-semibold">
                {String(p.platform ?? "")}
                {p.profileUrl ? (
                  <>
                    {" · "}
                    <a
                      href={String(p.profileUrl)}
                      target="_blank"
                      className="text-accent"
                    >
                      profile
                    </a>
                  </>
                ) : null}
              </p>
              {p.notes && <p className="text-paper/60">{String(p.notes)}</p>}
            </li>
          ))}
        </ul>
      }
    />
  );
}
