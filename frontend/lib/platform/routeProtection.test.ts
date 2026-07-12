import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isApiPath,
  isPublicPath,
  isSafeCallbackUrl,
  requiresPlatformAdmin,
  sanitizeCallbackUrl,
} from "./routeProtection.ts";

describe("routeProtection", () => {
  it("allows public auth and invite surfaces", () => {
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/api/auth/session"), true);
    assert.equal(isPublicPath("/api/health"), true);
    assert.equal(isPublicPath("/invite/abc"), true);
    assert.equal(isPublicPath("/api/invite/abc"), true);
    assert.equal(isPublicPath("/forbidden"), true);
    assert.equal(isPublicPath("/b/x/home"), false);
    assert.equal(isPublicPath("/admin"), false);
  });

  it("sanitizes callback destinations against open redirects", () => {
    assert.equal(isSafeCallbackUrl("/b/abc/home"), true);
    assert.equal(isSafeCallbackUrl("/b/abc/home?x=1"), true);
    assert.equal(isSafeCallbackUrl("//evil.com"), false);
    assert.equal(isSafeCallbackUrl("https://evil.com"), false);
    assert.equal(isSafeCallbackUrl("/\\evil"), false);
    assert.equal(sanitizeCallbackUrl("//evil.com"), "/");
    assert.equal(sanitizeCallbackUrl("/b/abc/work"), "/b/abc/work");
  });

  it("identifies platform-admin surfaces including APIs", () => {
    assert.equal(requiresPlatformAdmin("/admin"), true);
    assert.equal(requiresPlatformAdmin("/admin/users"), true);
    assert.equal(requiresPlatformAdmin("/platform"), true);
    assert.equal(requiresPlatformAdmin("/api/admin/support/enter"), true);
    assert.equal(requiresPlatformAdmin("/api/platform/businesses"), true);
    assert.equal(requiresPlatformAdmin("/api/dev/invitations"), true);
    assert.equal(requiresPlatformAdmin("/b/x/home"), false);
    assert.equal(isApiPath("/api/businesses/x/work"), true);
    assert.equal(isApiPath("/b/x/home"), false);
  });
});
