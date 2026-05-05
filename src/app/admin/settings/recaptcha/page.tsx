import { prisma } from "@/lib/prisma";
import RecaptchaSettingsForm from "./RecaptchaSettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "reCAPTCHA — Admin",
  robots: { index: false, follow: false },
};

export default async function RecaptchaSettingsPage() {
  const row = await prisma.platformSetting.findUnique({ where: { id: "default" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Google reCAPTCHA v2</h1>
      <p className="mt-1 text-sm text-paper/60">
        Protects sign-in, sign-up, forgot-password, and the seller
        application from automated abuse. Get your keys at{" "}
        <a
          href="https://www.google.com/recaptcha/admin/create"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          google.com/recaptcha/admin
        </a>{" "}
        — pick <strong>reCAPTCHA v2 → &ldquo;I&rsquo;m not a robot&rdquo; checkbox</strong>.
      </p>

      <RecaptchaSettingsForm
        initial={{
          enabled: row?.recaptchaEnabled ?? false,
          siteKey: row?.recaptchaSiteKey ?? "",
          // The secret is server-only; we display only whether one is set.
          secretSet: !!row?.recaptchaSecretKey,
        }}
      />
    </div>
  );
}
