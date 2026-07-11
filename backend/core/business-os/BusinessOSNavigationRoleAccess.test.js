import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveRoleAccess, canAccessModule } from "./BusinessOSRoleAccess.js";
import { buildBusinessOSNavigation } from "./BusinessOSNavigationBuilder.js";
import { isSafeModuleRoute, resolveSafeModuleHref } from "./BusinessOSSafeRoutes.js";
import { exportMcBrideBusinessOSSpecification } from "./McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "./fixtures/HockeyTravelClubSpecification.js";
import { BusinessOSCompiler } from "./BusinessOSCompiler.js";
import { BusinessOSInstaller } from "./BusinessOSInstaller.js";
import { createBusinessOSInstallationApproval } from "./BusinessOSInstallationApproval.js";

const NOW = "2026-07-10T23:00:00.000Z";

test("safe routes reject arbitrary module destinations", () => {
  assert.equal(isSafeModuleRoute("properties"), true);
  assert.equal(isSafeModuleRoute("custom_generated_page"), false);
  assert.equal(resolveSafeModuleHref("properties", { businessId: "biz_1" }), "/b/biz_1/properties");
  assert.equal(resolveSafeModuleHref("custom_generated_page", { businessId: "biz_1" }), null);
});

test("maintenance technician role hides campaigns and settings", () => {
  const spec = exportMcBrideBusinessOSSpecification();
  const access = resolveRoleAccess({
    specification: spec,
    membershipRole: "EMPLOYEE",
    roleId: "maintenance_technician",
  });
  assert.ok(canAccessModule({ roleAccess: access, moduleId: "work" }));
  assert.ok(canAccessModule({ roleAccess: access, moduleId: "properties" }));
  assert.equal(canAccessModule({ roleAccess: access, moduleId: "campaigns" }), false);
  assert.equal(canAccessModule({ roleAccess: access, moduleId: "settings" }), false);
});

test("marketing manager sees campaigns but not owner settings", () => {
  const spec = exportMcBrideBusinessOSSpecification();
  const access = resolveRoleAccess({
    specification: spec,
    membershipRole: "MANAGER",
    roleId: "marketing_manager",
  });
  assert.ok(canAccessModule({ roleAccess: access, moduleId: "campaigns" }));
  assert.ok(canAccessModule({ roleAccess: access, moduleId: "knowledge" }));
  assert.equal(canAccessModule({ roleAccess: access, moduleId: "settings" }), false);
});

test("McBride default navigation remains property-management shaped with overflow", () => {
  const spec = exportMcBrideBusinessOSSpecification();
  const nav = buildBusinessOSNavigation({
    modules: spec.modules,
    navigation: { ...spec.navigation, primaryItems: [] },
    businessId: "biz_mcbride",
    permissions: new Set(["work.view", "people.view", "inbox.view", "team.manage", "performance.view", "integrations.manage", "settings.manage"]),
  });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "properties"));
  assert.ok(nav.primaryItems.every((item) => item.moduleId === "more" || item.href?.startsWith("/b/biz_mcbride/")));
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "more") || nav.primaryItems.length <= 8);
  assert.equal(nav.employeePlacement, "digital_workforce");
});

test("hockey installed configuration drives different navigation labels", () => {
  const spec = createHockeyTravelClubSpecification({ businessId: "biz_hockey_nav" });
  const compiled = new BusinessOSCompiler().compile(spec, { nowISO: NOW });
  const installer = new BusinessOSInstaller();
  const dry = installer.dryRun({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_hockey_nav",
    nowISO: NOW,
  });
  const approval = createBusinessOSInstallationApproval({
    approvalId: "appr_nav",
    businessId: "biz_hockey_nav",
    specificationId: spec.specificationId,
    specificationVersion: spec.version,
    specificationContentHash: spec.contentHash,
    planId: compiled.plan.planId,
    planHash: compiled.plan.planHash,
    approvedByUserId: "owner",
  });
  const installed = installer.install({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_hockey_nav",
    dryRunResult: dry,
    approval,
    nowISO: NOW,
  });
  assert.equal(installed.ok, true);
  const nav = buildBusinessOSNavigation({
    modules: installed.configuration.modules.map((module) => ({
      ...module,
      primaryNavigationEligible: true,
      navigationPriority: module.navigationPriority ?? 10,
    })),
    navigation: { maximumPrimaryItems: 8, overflowBehavior: "more", primaryItems: [] },
    businessId: "biz_hockey_nav",
  });
  assert.ok(nav.primaryItems.some((item) => item.label === "Teams" || item.moduleId === "teams"));
  assert.ok(!JSON.stringify(nav).includes("PropertyRuntime"));
  assert.ok(!JSON.stringify(nav).includes("HockeyRuntime"));
});
