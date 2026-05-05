// Magic-link confirmation page. The link in the email goes here, not
// directly to /api/auth/callback/sendgrid. We render a "Click to sign
// in" button that navigates to the real callback only when the user
// presses it. Gmail / Outlook / corporate URL scanners pre-fetch the
// email link to check for malware; if they hit the raw callback, the
// one-shot verification token is consumed and the user lands on a
// "Verification" error when they try to use the link for real. Bots
// don't click buttons, so this layer fixes that.

import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Confirm sign-in — Indie Comics Live",
  robots: { index: false, follow: false },
};

function isLikelyEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

export default async function ConfirmSignIn({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; callbackUrl?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const token = sp.token?.trim();
  const email = sp.email?.trim();
  const callbackUrl = sp.callbackUrl?.trim();

  if (!token || !email || !isLikelyEmail(email)) {
    return (
      <main className="mx-auto max-w-md px-4 pb-20 pt-12">
        <h1 className="text-2xl font-bold">Link incomplete</h1>
        <p className="mt-3 text-sm text-paper/60">
          This sign-in link is missing required pieces. Try requesting a
          fresh one from the sign-in page.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink"
        >
          Back to sign in
        </Link>
      </main>
    );
  }

  // Build the actual NextAuth callback URL. We forward the user there
  // by GET when they click — that's when the token is consumed.
  const callback = new URL("/api/auth/callback/sendgrid", "http://localhost");
  callback.searchParams.set("token", token);
  callback.searchParams.set("email", email);
  if (callbackUrl) callback.searchParams.set("callbackUrl", callbackUrl);
  const callbackHref = `${callback.pathname}?${callback.searchParams.toString()}`;

  return (
    <main className="mx-auto max-w-md px-4 pb-20 pt-12">
      <h1 className="text-2xl font-bold">One last step</h1>
      <p className="mt-3 text-sm text-paper/70">
        Click the button below to finish signing in as{" "}
        <strong className="text-paper">{email}</strong>.
      </p>
      <p className="mt-1 text-xs text-paper/50">
        We make you click instead of auto-redirecting because some email
        providers (Gmail, Outlook) silently visit links to scan them for
        malware. If we auto-signed you in on link visit, those bots would
        eat your one-shot token before you got here.
      </p>

      <a
        href={callbackHref}
        rel="nofollow noopener"
        className="mt-8 inline-block rounded-full bg-accent px-7 py-3 text-sm font-bold text-ink"
      >
        Sign me in
      </a>

      <p className="mt-6 text-xs text-paper/50">
        Didn&rsquo;t request this?{" "}
        <Link href="/" className="text-accent hover:underline">
          Just close the tab.
        </Link>
      </p>
    </main>
  );
}
