import Link from "next/link";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import SignUpForm from "./SignUpForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create account — Indie Comics Live",
};

function safeNext(c?: string): string {
  return typeof c === "string" && c.startsWith("/") ? c : "/post-signin";
}

export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const next = safeNext(sp.callbackUrl);
  const { siteKey } = await getRecaptchaSiteKey();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 text-sm text-paper/60">
        Already have one?{" "}
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(next)}`} className="text-accent hover:underline">
          Sign in
        </Link>
        .
      </p>
      <SignUpForm siteKey={siteKey} callbackUrl={next} />
    </main>
  );
}
