import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyAdminPassword } from "@/lib/admin-password";

// Email + password sign-in for everyone. The Credentials provider:
//   - looks up the User by email
//   - verifies the supplied password against User.passwordHash (scrypt)
//   - has a side path for the env-configured admin (ADMIN_EMAIL +
//     ADMIN_PASSWORD_HASH) that auto-promotes that user to super_admin
//
// Magic-link / SendGrid email auth was removed — too many email-client
// link scanners pre-fetch the one-shot verification URL and consume it
// before the user clicks. Password auth is the simplest path that
// works behind any proxy / scanner.
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  debug: process.env.AUTH_DEBUG === "1",
  logger: {
    error(error) {
      console.error("[auth] error", { name: error.name, message: error.message });
    },
    warn(code) {
      console.warn("[auth] warn", code);
    },
  },
  events: {
    signIn(message) {
      console.log("[auth] signIn", {
        email: message.user?.email,
        provider: message.account?.provider,
      });
    },
    createUser(message) {
      console.log("[auth] createUser", { email: message.user.email });
    },
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        // Admin env override — gives staff access via ADMIN_EMAIL +
        // ADMIN_PASSWORD_HASH even before the corresponding User row
        // has a passwordHash of its own. First successful staff login
        // promotes the user to super_admin.
        const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
        const adminHash = process.env.ADMIN_PASSWORD_HASH ?? "";
        if (adminEmail && adminHash && email === adminEmail) {
          const ok = await verifyAdminPassword(password, adminHash);
          if (!ok) return null;
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({
              data: { email, role: "super_admin" },
            });
          } else if (user.role !== "super_admin" && user.role !== "admin") {
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
        }

        // Regular user with a stored passwordHash.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await verifyAdminPassword(password, user.passwordHash);
        if (!ok) return null;
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
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        const u = user as { role?: string };
        if (u.role) token.role = u.role;
      } else if (token.sub && !token.role) {
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
