import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedUser } from "@/lib/onboarding";
import { loadNmiConfig } from "@/lib/nmi";
import { getActiveProcessor } from "@/lib/divinitycoin";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Apply to sell — Indie Comics Live",
  description:
    "Apply to host live auctions on Indie Comics Live, the adult-friendly Whatnot alternative for indie comics and trading cards.",
  alternates: { canonical: "/seller/apply" },
};

export default async function SellerApplyPage() {
  const me = await requireOnboardedUser("/seller/apply");

  const [existing, bank, card] = await Promise.all([
    prisma.sellerApplication.findUnique({ where: { userId: me.id } }),
    prisma.paymentCloudBankAccount.findUnique({
      where: { userId: me.id },
      select: {
        bankNameDisplay: true,
        accountLastFour: true,
        accountType: true,
      },
    }),
    prisma.sellerChargebackCard.findUnique({
      where: { userId: me.id },
      select: { cardBrand: true, cardLastFour: true },
    }),
  ]);

  // Already approved? Send them to their dashboard.
  if (existing?.status === "approved") redirect("/seller");

  const config = loadNmiConfig();
  const nmiPublicKey = config?.publicKey ?? null;
  const processor = await getActiveProcessor();
  const { siteKey: recaptchaSiteKey } = await getRecaptchaSiteKey();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <a href="/sell" className="text-sm text-paper/60">
        ← About selling
      </a>
      <h1 className="mt-3 text-3xl font-bold">Apply to sell</h1>
      <p className="mt-2 max-w-xl text-sm text-paper/70">
        We do real KYC on every seller. Applications usually decision within
        2&ndash;3 business days. Adult-friendly content is welcome &mdash; you
        just have to attest to age + content guidelines.
      </p>

      <ApplyForm
        userEmail={me.email}
        existing={existing}
        bank={bank}
        chargebackCard={card}
        nmiPublicKey={nmiPublicKey}
        processor={processor}
        recaptchaSiteKey={recaptchaSiteKey}
      />
    </main>
  );
}
