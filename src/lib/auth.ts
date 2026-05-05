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
  // We're always behind nginx + (optionally) Cloudflare in production.
  // Without trustHost, Auth.js refuses the magic-link callback when it
  // can't trust X-Forwarded-Host, which manifests as "I clicked the
  // link and the site opened but I'm not signed in." Always trust here.
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
        isNewUser: message.isNewUser,
        provider: message.account?.provider,
      });
    },
    createUser(message) {
      console.log("[auth] createUser", { email: message.user.email });
    },
  },
  providers: [
    SendGrid({
      apiKey: process.env.AUTH_SENDGRID_KEY,
      from: process.env.AUTH_EMAIL_FROM,
      // Override the default email to send a link to our /sign-in/confirm
      // page (which renders a "Click to sign in" button) instead of the
      // raw callback. Gmail / Outlook / corporate link-safety scanners
      // GET the email link before the user clicks; on the raw callback
      // that GET silently consumes the one-shot verification token and
      // the user lands on a "Verification" error. The confirm page is a
      // plain HTML page — bots fetch it harmlessly. Only the button
      // click navigates to the real callback URL where the token is
      // consumed for real.
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const apiKey = provider.apiKey as string | undefined;
        const fromCfg = provider.from;
        const from =
          typeof fromCfg === "string"
            ? fromCfg
            : fromCfg && typeof fromCfg === "object" && "email" in fromCfg
              ? String((fromCfg as { email: unknown }).email ?? "")
              : "";
        if (!apiKey || !from) {
          throw new Error("SendGrid not configured for magic-link sign-in");
        }
        const callback = new URL(url);
        const token = callback.searchParams.get("token") ?? "";
        const encodedEmail = encodeURIComponent(email);
        const confirmUrl = new URL(callback.origin);
        confirmUrl.pathname = "/sign-in/confirm";
        confirmUrl.searchParams.set("token", token);
        confirmUrl.searchParams.set("email", email);
        const callbackUrl = callback.searchParams.get("callbackUrl");
        if (callbackUrl) confirmUrl.searchParams.set("callbackUrl", callbackUrl);

        const host = callback.host;
        const subject = `Sign in to ${host}`;
        const text = [
          `Sign in to ${host} as ${email} by clicking this link:`,
          ``,
          confirmUrl.toString(),
          ``,
          `If you didn't request this, you can ignore the message.`,
        ].join("\n");
        const html = `
          <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:32px">
            <div style="max-width:480px;margin:0 auto">
              <h1 style="font-size:20px;margin:0 0 16px">Sign in to Indie Comics Live</h1>
              <p style="margin:0 0 24px;color:#aaa">
                You're signing in as <strong style="color:#fff">${email}</strong>. Click the
                button below to finish — it's a one-time link tied to this email.
              </p>
              <p style="margin:0 0 24px">
                <a href="${confirmUrl.toString()}"
                   style="display:inline-block;background:#ff3366;color:#fff;text-decoration:none;
                          padding:14px 28px;border-radius:999px;font-weight:700">
                  Sign in
                </a>
              </p>
              <p style="margin:0;color:#666;font-size:12px">
                If the button doesn't work, copy this URL into your browser:<br>
                <span style="color:#888">${confirmUrl.toString()}</span>
              </p>
              <p style="margin:24px 0 0;color:#666;font-size:12px">
                Didn't ask for this? You can safely ignore this email.
              </p>
            </div>
          </body>`;

        const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: from, name: "Indie Comics Live" },
            subject,
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html },
            ],
          }),
        });
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          console.error("[auth] SendGrid magic-link send failed", {
            status: r.status,
            body: body.slice(0, 500),
            to: encodedEmail,
          });
          throw new Error(`SendGrid send failed: ${r.status}`);
        }
      },
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
