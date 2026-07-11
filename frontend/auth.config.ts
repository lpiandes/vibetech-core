import type { NextAuthConfig } from "next-auth";

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
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health"
      ) {
        return true;
      }

      if (
        pathname === "/login"
        || pathname.startsWith("/invite/")
        || pathname.startsWith("/api/invite/")
      ) {
        return true;
      }

      if (pathname.startsWith("/api/dev/")) {
        if (process.env.NODE_ENV === "production") return false;
        if (!isLoggedIn) return false;
        return auth?.user?.platformRole === "PLATFORM_ADMIN";
      }

      if (!isLoggedIn) {
        return false;
      }

      if (pathname.startsWith("/platform") || pathname.startsWith("/admin")) {
        return auth?.user?.platformRole === "PLATFORM_ADMIN";
      }

      const legacyPrefixes = [
        "/home",
        "/mission-control",
        "/work",
        "/engagement",
        "/communications",
        "/team",
        "/knowledge",
        "/analytics",
        "/connections",
        "/setup",
        "/attention",
        "/dashboard",
      ];
      if (legacyPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
