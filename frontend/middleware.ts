import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const mwStart = Date.now();
  const { pathname, search } = request.nextUrl;

  // Canonical business-portal aliases — hard redirects (avoid soft RSC 200 + NEXT_REDIRECT only).
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
