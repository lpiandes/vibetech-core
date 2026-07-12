import type { NextAuthConfig } from "next-auth";

/**
 * Auth.js config. Route gating lives in middleware.ts (explicit login redirect /
 * JSON 401 / admin 403) so custom middleware + authorized() do not fight.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.platformRole = (user as { platformRole?: string | null }).platformRole ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.platformRole = (token.platformRole as string | null) ?? null;
      }
      return session;
    },
    authorized() {
      // Middleware owns authentication/authorization responses.
      return true;
    },
  },
} satisfies NextAuthConfig;
