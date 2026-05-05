import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin sign in — Indie Comics Live",
  robots: { index: false, follow: false },
};

type Search = { error?: string; next?: string };

export default async function AdminSignIn({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  // If you're already signed in as an admin, jump straight in.
  const session = await auth();
  if (session?.user?.id) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (me && (me.role === "admin" || me.role === "super_admin")) {
      redirect("/admin");
    }
  }

  const { error, next } = (await searchParams) ?? {};
  const failed = error === "credentialssignin" || error === "credentials";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold">Admin sign in</h1>
      <p className="mb-6 text-sm text-paper/60">
        Staff only. Use your email and password.
      </p>

      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn("admin-credentials", {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            redirectTo: next || "/admin",
          });
        }}
        className="space-y-3"
      >
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="email"
          className="w-full rounded-lg border border-white/10 bg-ink/40 px-3 py-2 text-paper outline-none focus:border-accent"
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="password"
          className="w-full rounded-lg border border-white/10 bg-ink/40 px-3 py-2 text-paper outline-none focus:border-accent"
        />
        {failed ? (
          <p className="text-sm text-red-400">Invalid email or password.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-3 py-2 font-semibold text-ink hover:bg-accent/90"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
