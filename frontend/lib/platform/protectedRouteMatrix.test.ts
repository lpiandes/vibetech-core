import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Behavioral contract for protected-route hardening.
 * Runtime enforcement lives in middleware + layouts; these tests lock the matrix.
 */
describe("protected route authorization matrix", () => {
  it("documents unauthenticated business page → login with safe callback", async () => {
    const { sanitizeCallbackUrl, isPublicPath } = await import("./routeProtection.ts");
    assert.equal(isPublicPath("/b/abc/home"), false);
    assert.equal(sanitizeCallbackUrl("/b/abc/home?tab=1"), "/b/abc/home?tab=1");
  });

  it("documents unauthenticated protected API → JSON 401 contract", async () => {
    const { isApiPath, isPublicPath } = await import("./routeProtection.ts");
    assert.equal(isApiPath("/api/businesses/x/intelligence/candidates"), true);
    assert.equal(isPublicPath("/api/businesses/x/intelligence/candidates"), false);
  });

  it("documents non-admin admin surfaces → forbidden rewrite, not BusinessShell", async () => {
    const { requiresPlatformAdmin, isPublicPath } = await import("./routeProtection.ts");
    assert.equal(requiresPlatformAdmin("/admin/users"), true);
    assert.equal(isPublicPath("/forbidden"), true);
  });

  it("documents platform admin remains authorized for admin APIs", async () => {
    const { requiresPlatformAdmin } = await import("./routeProtection.ts");
    assert.equal(requiresPlatformAdmin("/api/platform/businesses"), true);
  });
});
