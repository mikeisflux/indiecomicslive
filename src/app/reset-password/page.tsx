import Link from "next/link";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Choose a new password — Indie Comics Live",
};

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const token = (sp.token ?? "").trim();
  const { siteKey } = await getRecaptchaSiteKey();

  if (!token) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="mb-2 text-2xl font-bold">Link incomplete</h1>
        <p className="text-sm text-paper/60">
          This reset link is missing the token. Request a fresh one from{" "}
          <Link href="/forgot-password" className="text-accent hover:underline">
            forgot password
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 text-sm text-paper/60">
        After saving you&rsquo;ll be signed in automatically.
      </p>
      <ResetPasswordForm token={token} siteKey={siteKey} />
    </main>
  );
}
