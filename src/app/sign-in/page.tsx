import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { getRecaptchaSiteKey, verifyRecaptcha } from "@/lib/recaptcha";
import RecaptchaWidget from "@/components/RecaptchaWidget";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Indie Comics Live",
};

function safeNext(c?: string): string {
  // Default routes through /post-signin which sends sellers to the
  // seller dashboard, admins to admin, and buyers to orders. An
  // explicit callbackUrl (deep-link bounce) is honored as-is.
  return typeof c === "string" && c.startsWith("/") ? c : "/post-signin";
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const next = safeNext(sp.callbackUrl);
  const { siteKey } = await getRecaptchaSiteKey();
  const errorMsg =
    sp.error === "credentials"
      ? "That email and password don't match."
      : sp.error === "captcha"
        ? "Please complete the captcha."
        : sp.error
          ? "Sign-in failed. Try again."
          : null;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="icl-glass icl-fade-up rounded-3xl p-7">
        <Link
          href="/"
          className="mb-4 inline-block text-xs font-bold uppercase tracking-[0.25em] text-accent"
        >
          ← Indie Comics Live
        </Link>
        <h1 className="text-3xl font-black">Welcome back</h1>
        <p className="mb-5 mt-1 text-sm text-paper/60">
          New here?{" "}
          <Link
            href={`/sign-up?callbackUrl=${encodeURIComponent(next)}`}
            className="text-accent hover:underline"
          >
            Create an account
          </Link>
          .
        </p>

      <form
        action={async (formData) => {
          "use server";
          const captcha = await verifyRecaptcha(
            formData.get("g-recaptcha-response")?.toString() ?? null,
            await clientIp(),
          );
          if (!captcha.ok) {
            redirect(
              `/sign-in?error=captcha&callbackUrl=${encodeURIComponent(next)}` +
                (formData.get("email")
                  ? `&email=${encodeURIComponent(String(formData.get("email")))}`
                  : ""),
            );
          }
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              totp: formData.get("totp"),
              redirectTo: next,
            });
          } catch (err) {
            if (err instanceof AuthError) {
              redirect(
                `/sign-in?error=credentials&callbackUrl=${encodeURIComponent(next)}` +
                  (formData.get("email")
                    ? `&email=${encodeURIComponent(String(formData.get("email")))}`
                    : ""),
              );
            }
            throw err;
          }
        }}
        className="space-y-3"
      >
        <input
          name="email"
          type="email"
          required
          autoFocus={!sp.email}
          defaultValue={typeof sp.email === "string" ? sp.email : ""}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          autoFocus={!!sp.email}
          placeholder="Password"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Authenticator code (only if you set up 2FA)"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <RecaptchaWidget siteKey={siteKey} />
        {errorMsg && <p className="text-sm text-red-300">{errorMsg}</p>}
        <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,51,102,0.45)] transition hover:shadow-[0_0_36px_rgba(255,51,102,0.65)]">
          Sign in →
        </button>
      </form>

        <p className="mt-6 text-center text-xs text-paper/50">
          <Link href="/forgot-password" className="hover:text-paper">
            Forgot password?
          </Link>
        </p>
      </div>
    </main>
  );
}
