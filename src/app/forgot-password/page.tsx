import Link from "next/link";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset password — Indie Comics Live",
};

export default async function ForgotPassword() {
  const { siteKey } = await getRecaptchaSiteKey();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-paper/60">
        We&rsquo;ll email a reset link to the address on file.
      </p>
      <ForgotPasswordForm siteKey={siteKey} />
      <p className="mt-6 text-center text-xs text-paper/50">
        <Link href="/sign-in" className="hover:text-paper">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
