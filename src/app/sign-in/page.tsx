import { signIn } from "@/lib/auth";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
  const { email, callbackUrl } = (await searchParams) ?? {};
  const safeNext =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/")
      ? callbackUrl
      : "/";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-paper/60">
        We&rsquo;ll send a magic link.
      </p>
      <form
        action={async (formData) => {
          "use server";
          formData.set("redirectTo", safeNext);
          await signIn("sendgrid", formData);
        }}
        className="space-y-3"
      >
        <input
          name="email"
          type="email"
          required
          autoFocus={!email}
          defaultValue={typeof email === "string" ? email : ""}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <button className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
          Email me a link
        </button>
      </form>
    </main>
  );
}
