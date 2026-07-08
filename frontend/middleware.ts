import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const mwStart = Date.now();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
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
