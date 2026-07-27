import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";
import {
  isApiPath,
  isPublicPath,
  requiresPlatformAdmin,
  sanitizeCallbackUrl,
} from "./lib/platform/routeProtection";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const mwStart = Date.now();
  const { pathname, search } = request.nextUrl;
  const host = String(request.headers.get("host") ?? "").toLowerCase();
  const isSocialHost = host.startsWith("social.") || host.startsWith("social-checker.");

  // social.vtechdevelopment.com → public Social Checker surface
  if (isSocialHost && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/social-checker";
    return NextResponse.rewrite(url);
  }

  const isLoggedIn = Boolean(request.auth?.user);
  const platformRole = (request.auth?.user as { platformRole?: string | null } | undefined)?.platformRole ?? null;

  // Canonical business-portal aliases — hard redirects.
  const missionControl = pathname.match(/^\/b\/([^/]+)\/mission-control\/?$/);
  if (missionControl) {
    const url = request.nextUrl.clone();
    url.pathname = `/b/${missionControl[1]}/home`;
    return NextResponse.redirect(url);
  }
  const forYou = pathname.match(/^\/b\/([^/]+)\/for-you\/?$/);
  if (forYou) {
    const url = request.nextUrl.clone();
    url.pathname = `/b/${forYou[1]}/intelligence`;
    return NextResponse.redirect(url);
  }

  if (!isPublicPath(pathname)) {
    if (pathname.startsWith("/api/dev/") && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not available.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    if (!isLoggedIn) {
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { error: "Sign in required.", code: "UNAUTHENTICATED" },
          { status: 401 },
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      const callbackUrl = sanitizeCallbackUrl(`${pathname}${search}`);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    if (requiresPlatformAdmin(pathname) && platformRole !== "PLATFORM_ADMIN") {
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { error: "Platform administrator access required.", code: "FORBIDDEN" },
          { status: 403 },
        );
      }
      // Clean 403 page — never wrap in AdminShell.
      const forbiddenUrl = request.nextUrl.clone();
      forbiddenUrl.pathname = "/forbidden";
      forbiddenUrl.search = "";
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-search", search || "");
  requestHeaders.set("x-vibetech-req-start", String(mwStart));

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const mwMs = Date.now() - mwStart;
  response.headers.set("Server-Timing", `middleware;dur=${mwMs}`);
  response.headers.set("x-vibetech-middleware-ms", String(mwMs));
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
