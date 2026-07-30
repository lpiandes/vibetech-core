import test from "node:test";
import assert from "node:assert/strict";

import {
  businessGrantsSocialCheckerAccess,
  isSocialCheckerOnlyPurchasedScope,
  isUserSocialCheckerOnly,
  resolveSocialCheckerEntitlement,
  SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID,
} from "./socialCheckerEntitlement.js";

test("businessGrantsSocialCheckerAccess: empty packages (full OS) is entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess([]), true);
});

test("businessGrantsSocialCheckerAccess: full-OS package id is entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess(["ai_business_os"]), true);
});

test("businessGrantsSocialCheckerAccess: social_background_screening alone is entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID]), true);
});

test("businessGrantsSocialCheckerAccess: unrelated thin SKU is not entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess(["ai_receptionist"]), false);
});

test("resolveSocialCheckerEntitlement: platform admin is always entitled", () => {
  const result = resolveSocialCheckerEntitlement({ platformRole: "PLATFORM_ADMIN", businesses: [] });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "platform_admin");
});

test("resolveSocialCheckerEntitlement: no businesses and no admin role is not entitled", () => {
  const result = resolveSocialCheckerEntitlement({ platformRole: null, businesses: [] });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "none");
});

test("resolveSocialCheckerEntitlement: business with full-OS scope entitles the user", () => {
  const result = resolveSocialCheckerEntitlement({
    businesses: [{ id: "biz-1", packageConfiguration: {} }],
  });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "full_os");
  assert.equal(result.businessId, "biz-1");
});

test("resolveSocialCheckerEntitlement: business with social_background_screening entitles the user", () => {
  const result = resolveSocialCheckerEntitlement({
    businesses: [
      { id: "biz-1", packageConfiguration: { purchasedPackages: ["ai_receptionist"] } },
      { id: "biz-2", packageConfiguration: { purchasedPackages: [SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID] } },
    ],
  });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "social_package");
  assert.equal(result.businessId, "biz-2");
});

test("resolveSocialCheckerEntitlement: businesses with unrelated thin SKUs only is not entitled", () => {
  const result = resolveSocialCheckerEntitlement({
    businesses: [
      { id: "biz-1", packageConfiguration: { purchasedPackages: ["ai_receptionist"] } },
      { id: "biz-2", packageConfiguration: { purchasedPackages: ["social_content_automation"] } },
    ],
  });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "none");
});

test("isSocialCheckerOnlyPurchasedScope: true only for the lone social SKU", () => {
  assert.equal(isSocialCheckerOnlyPurchasedScope([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID]), true);
  assert.equal(isSocialCheckerOnlyPurchasedScope([]), false, "empty scope is full OS, not social-only");
  assert.equal(isSocialCheckerOnlyPurchasedScope(["ai_business_os"]), false);
  assert.equal(
    isSocialCheckerOnlyPurchasedScope([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID, "ai_receptionist"]),
    false,
    "additional package alongside social means not social-only",
  );
});

test("isUserSocialCheckerOnly: true only when every business is social-only", () => {
  assert.equal(
    isUserSocialCheckerOnly([
      { packageConfiguration: { purchasedPackages: [SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID] } },
    ]),
    true,
  );
  assert.equal(
    isUserSocialCheckerOnly([
      { packageConfiguration: { purchasedPackages: [SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID] } },
      { packageConfiguration: {} },
    ]),
    false,
    "any full-OS business disqualifies social-only",
  );
  assert.equal(isUserSocialCheckerOnly([]), false, "no businesses is not social-only");
});
