import test from "node:test";
import assert from "node:assert/strict";

import {
  businessGrantsSocialCheckerAccess,
  isSocialCheckerOnlyPurchasedScope,
  isUserSocialCheckerOnly,
  resolveSocialCheckerEntitlement,
  SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID,
} from "./socialCheckerEntitlement.js";

test("businessGrantsSocialCheckerAccess: empty packages is NOT entitled (must tick social package)", () => {
  assert.equal(businessGrantsSocialCheckerAccess([]), false);
});

test("businessGrantsSocialCheckerAccess: full-OS package alone is NOT entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess(["ai_business_os"]), false);
});

test("businessGrantsSocialCheckerAccess: social_background_screening alone is entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID]), true);
});

test("businessGrantsSocialCheckerAccess: social package alongside other SKUs is entitled", () => {
  assert.equal(
    businessGrantsSocialCheckerAccess([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID, "ai_receptionist"]),
    true,
  );
});

test("businessGrantsSocialCheckerAccess: unrelated thin SKU is not entitled", () => {
  assert.equal(businessGrantsSocialCheckerAccess(["ai_receptionist"]), false);
});

test("resolveSocialCheckerEntitlement: platform admin is NOT auto-entitled without the package", () => {
  const result = resolveSocialCheckerEntitlement({ platformRole: "PLATFORM_ADMIN", businesses: [] });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "none");
});

test("resolveSocialCheckerEntitlement: no businesses is not entitled", () => {
  const result = resolveSocialCheckerEntitlement({ platformRole: null, businesses: [] });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "none");
});

test("resolveSocialCheckerEntitlement: empty packageConfiguration (legacy full OS) is not entitled", () => {
  const result = resolveSocialCheckerEntitlement({
    businesses: [{ id: "biz-1", packageConfiguration: {} }],
  });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "none");
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
  assert.equal(isSocialCheckerOnlyPurchasedScope([]), false);
  assert.equal(isSocialCheckerOnlyPurchasedScope(["ai_business_os"]), false);
  assert.equal(
    isSocialCheckerOnlyPurchasedScope([SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID, "ai_receptionist"]),
    false,
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
  );
  assert.equal(isUserSocialCheckerOnly([]), false);
});
