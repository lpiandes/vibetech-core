/**
 * Pure route-protection helpers for Auth.js middleware.
 * Kept free of Next/Auth imports so unit tests stay edge-safe.
 */

export function isPublicPath(pathname: string): boolean {
  if (
    pathname.startsWith("/_next")
    || pathname.startsWith("/favicon")
    || pathname.startsWith("/api/auth")
    || pathname === "/api/health"
    // Cron / worker backup — authorized inside the route via CRON_SECRET.
    || pathname === "/api/platform/jobs/tick"
  ) {
    return true;
  }
  // Social Checker landing page stays reachable while signed out so it can
  // render its own sign-in / book-a-call gate (see app/social-checker/page.tsx)
  // instead of bouncing straight to /login.
  if (pathname === "/social-checker" || pathname.startsWith("/social-checker/")) {
    return true;
  }
  if (
    pathname === "/api/social-checker/register"
    || pathname === "/api/social-checker/join"
  ) {
    return true;
  }
  if (
    pathname === "/api/marketing/consultant"
    || pathname === "/api/marketing/meeting-request"
  ) {
    return true;
  }
  // The search API itself requires auth + entitlement — checked in-route
  // (frontend/app/api/social-checker/search/route.ts) so it can return a
  // tailored 401/403 payload. NOT listed as public here on purpose.
  // Public intake surfaces (Meta signature / form rate-limit enforced in-route).
  if (/^\/api\/businesses\/[^/]+\/integrations\/meta\/webhook\/?$/.test(pathname)) {
    return true;
  }
  if (/^\/api\/businesses\/[^/]+\/forms\/submit\/?$/.test(pathname)) {
    return true;
  }
  if (pathname === "/login" || pathname.startsWith("/invite/") || pathname.startsWith("/api/invite/")) {
    return true;
  }
  if (pathname === "/forbidden" || pathname === "/unauthorized") {
    return true;
  }
  return false;
}

/** Relative same-origin destinations only — blocks open redirects. */
export function isSafeCallbackUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  if (value.includes("://")) return false;
  return true;
}

export function sanitizeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  return isSafeCallbackUrl(value) ? String(value) : fallback;
}

export function requiresPlatformAdmin(pathname: string): boolean {
  if (pathname === "/api/platform/jobs/tick") return false;
  return pathname.startsWith("/admin") || pathname.startsWith("/platform") || pathname.startsWith("/api/admin")
    || pathname.startsWith("/api/platform") || pathname.startsWith("/api/dev/");
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}
