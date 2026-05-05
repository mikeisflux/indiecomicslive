import NextAuth from "next-auth";
import SendGrid from "next-auth/providers/sendgrid";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyAdminPassword } from "@/lib/admin-password";

// Two ways to sign in:
//   1. SendGrid magic link  — the path everyone uses on /sign-in.
//   2. Credentials (email + password) — staff-only, gated by
//      ADMIN_EMAIL + ADMIN_PASSWORD_HASH env vars. Used at
//      /admin/sign-in so we don't have to wait on a magic link to
//      get into the admin panel.
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    SendGrid({
      apiKey: process.env.AUTH_SENDGRID_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
    Credentials({
      id: "admin-credentials",
      name: "Admin password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
        const adminHash = process.env.ADMIN_PASSWORD_HASH ?? "";
        if (!adminEmail || !adminHash) return null;
        if (email !== adminEmail) return null;

        const ok = await verifyAdminPassword(password, adminHash);
        if (!ok) return null;

        // Find or create the admin's user row (idempotent).
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, role: "super_admin" },
          });
        } else if (user.role !== "super_admin" && user.role !== "admin") {
          // First successful credential login also flips them to super_admin.
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: "super_admin" },
          });
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as { id: string; email: string | null; name: string | null; role: string };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: persist user id + role on the token.
        token.sub = user.id;
        const u = user as { role?: string };
        if (u.role) token.role = u.role;
      } else if (token.sub && !token.role) {
        // Subsequent calls: hydrate role from DB so /admin guards work
        // for users that started life as a magic-link viewer and were
        // promoted via grant-admin or first-credentials login.
        const u = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });
        if (u?.role) token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (typeof token.role === "string") session.user.role = token.role;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
    };
  }
  interface User {
    role?: string;
  }
}
