import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessOSCompiler } from "./BusinessOSCompiler.js";
import { BusinessOSInstaller } from "./BusinessOSInstaller.js";
import { BusinessOSInstallationRepository } from "./BusinessOSInstallationRepository.js";
import { createBusinessOSInstallationApproval } from "./BusinessOSInstallationApproval.js";
import { exportMcBrideBusinessOSSpecification } from "./McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "./fixtures/HockeyTravelClubSpecification.js";
import { createPropertyManagementGoldBlueprint } from "../blueprints/PropertyManagementGoldBlueprint.js";
import { createBlueprintRegistry, resetDefaultBlueprintRegistryForTests } from "../blueprints/BlueprintRegistry.js";
import { buildBusinessOSNavigation } from "./BusinessOSNavigationBuilder.js";
import { resolveRoleAccess, canAccessModule } from "./BusinessOSRoleAccess.js";
import { AccessRequestService, createInMemoryAccessRequestStore } from "../access-requests/AccessRequestService.js";
import {
  SupportAccessService,
  createInMemorySupportAccessStore,
} from "../platform/support/SupportAccessService.js";
import { MEMBERSHIP_ROLES, PLATFORM_ROLES } from "../platform/permissions/rolePermissions.js";
import { evaluateBusinessOSInstallReadiness } from "./BusinessOSReadinessEvaluator.js";

const NOW = "2026-07-11T00:00:00.000Z";

test("McBride gold blueprint compiles, dry-runs, installs, and leaves gold untouched", () => {
  resetDefaultBlueprintRegistryForTests();
  const registry = createBlueprintRegistry({ includeDefaults: true });
  const goldBlueprint = registry.get("bp_gold_property_management_mcbride");
  assert.equal(goldBlueprint.goldStatus, true);
  assert.equal(goldBlueprint.metadata.doesNotDuplicateMcBrideConfig, true);

  const goldSpec = exportMcBrideBusinessOSSpecification({ generatedAt: NOW });
  const goldFingerprint = goldSpec.contentHash;
  assert.equal(goldBlueprint.metadata.mcbrideContentHash, goldFingerprint);

  const freshBusinessId = "biz_mcbride_proof_fresh";
  const freshSpec = exportMcBrideBusinessOSSpecification({
    businessId: freshBusinessId,
    generatedAt: NOW,
  });
  const compiled = new BusinessOSCompiler().compile(freshSpec, { nowISO: NOW });
  assert.equal(compiled.ok, true);
  assert.ok(compiled.plan.planHash);
  assert.ok(compiled.plan.actions.some((action) => action.type === "INSTALL_INDUSTRY_PACKAGE"));
  assert.ok(compiled.plan.actions.some((action) => action.type === "INSTALL_ROLE"));
  assert.ok(compiled.plan.actions.some((action) => action.type === "CONFIGURE_ACCESS_REQUEST_POLICY"));

  const repository = new BusinessOSInstallationRepository();
  const installer = new BusinessOSInstaller({ repository });
  const dry = installer.dryRun({
    specification: freshSpec,
    plan: compiled.plan,
    businessId: freshBusinessId,
    nowISO: NOW,
  });
  assert.equal(dry.ok, true);
  assert.equal(dry.mutated, false);
  assert.equal(repository.getInstallation(freshBusinessId), null);

  const readiness = evaluateBusinessOSInstallReadiness({
    specification: freshSpec,
    plan: compiled.plan,
    dryRunCompleted: true,
    approved: false,
  });
  assert.equal(readiness.state, "ready_to_approve");

  const approval = createBusinessOSInstallationApproval({
    approvalId: "appr_mcbride_proof",
    businessId: freshBusinessId,
    specificationId: freshSpec.specificationId,
    specificationVersion: freshSpec.version,
    specificationContentHash: freshSpec.contentHash,
    planId: compiled.plan.planId,
    planHash: compiled.plan.planHash,
    approvedByUserId: "owner_mcbride",
  });

  const installed = installer.install({
    specification: freshSpec,
    plan: compiled.plan,
    businessId: freshBusinessId,
    dryRunResult: dry,
    approval,
    nowISO: NOW,
    existingGoldFingerprint: goldFingerprint,
  });
  assert.equal(installed.ok, true);
  assert.equal(installed.goldUnchanged, true);
  assert.equal(goldSpec.contentHash, goldFingerprint);
  assert.ok(installed.configuration.modules.some((module) => module.moduleId === "properties"));
  assert.ok(installed.configuration.employees.length >= 1);
  assert.ok(installed.configuration.roles.some((role) => role.roleId === "maintenance_technician"));
  assert.ok(installed.configuration.campaigns.length >= 1);
  assert.ok(
    installed.configuration.deferredCapabilities.includes("sms_messaging")
    || installed.configuration.deferredCapabilities.includes("sms"),
  );
  assert.ok(!JSON.stringify(installed.configuration).includes("PropertyRuntime"));

  const nav = buildBusinessOSNavigation({
    modules: freshSpec.modules,
    navigation: { ...freshSpec.navigation, primaryItems: [] },
    businessId: freshBusinessId,
    permissions: new Set(["work.view", "people.view", "inbox.view", "team.manage", "performance.view", "integrations.manage", "settings.manage"]),
  });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "properties"));
  assert.equal(nav.employeePlacement, "digital_workforce");

  // Idempotent reinstall / restart recovery
  const again = installer.resume({
    specification: freshSpec,
    plan: compiled.plan,
    businessId: freshBusinessId,
    dryRunResult: dry,
    approval,
    nowISO: "2026-07-11T00:30:00.000Z",
  });
  assert.equal(again.ok, true);
  assert.ok(again.actionResults.every((entry) => entry.status === "noop"));

  // No duplicate package configuration fingerprint change on gold source
  const goldAgain = createPropertyManagementGoldBlueprint();
  assert.equal(goldAgain.metadata.mcbrideContentHash, goldFingerprint);
});

test("Hockey fixture proves same universal runtime with different OS shape", async () => {
  const mcbrideId = "biz_mcbride_isolation";
  const hockeyId = "biz_hockey_proof";

  const mcbrideSpec = exportMcBrideBusinessOSSpecification({ businessId: mcbrideId, generatedAt: NOW });
  const hockeySpec = createHockeyTravelClubSpecification({ businessId: hockeyId, generatedAt: NOW });

  assert.notEqual(mcbrideSpec.terminology.presentation.BusinessSubject, hockeySpec.terminology.presentation.BusinessSubject);
  assert.ok(hockeySpec.modules.some((module) => module.moduleId === "teams"));
  assert.ok(hockeySpec.modules.some((module) => module.moduleId === "drills"));
  assert.ok(!hockeySpec.modules.some((module) => module.moduleId === "properties"));
  assert.ok(hockeySpec.employeeDefinitions.some((employee) => employee.label === "Scheduling Coordinator" || employee.label === "Schedule Coordinator"));
  assert.ok(hockeySpec.employeeDefinitions.some((employee) => employee.label === "Travel Coordinator"));
  assert.ok(hockeySpec.roleDefinitions.some((role) => role.roleId === "head_coach"));
  assert.ok(hockeySpec.roleDefinitions.some((role) => role.roleId === "player_parent"));

  const repository = new BusinessOSInstallationRepository();
  const installer = new BusinessOSInstaller({ repository });

  const mcbridePlan = new BusinessOSCompiler().compile(mcbrideSpec, { nowISO: NOW });
  const mcbrideDry = installer.dryRun({
    specification: mcbrideSpec,
    plan: mcbridePlan.plan,
    businessId: mcbrideId,
    nowISO: NOW,
  });
  const mcbrideApproval = createBusinessOSInstallationApproval({
    approvalId: "appr_mcbride_iso",
    businessId: mcbrideId,
    specificationId: mcbrideSpec.specificationId,
    specificationVersion: mcbrideSpec.version,
    specificationContentHash: mcbrideSpec.contentHash,
    planId: mcbridePlan.plan.planId,
    planHash: mcbridePlan.plan.planHash,
    approvedByUserId: "owner_a",
  });
  const mcbrideInstalled = installer.install({
    specification: mcbrideSpec,
    plan: mcbridePlan.plan,
    businessId: mcbrideId,
    dryRunResult: mcbrideDry,
    approval: mcbrideApproval,
    nowISO: NOW,
  });
  assert.equal(mcbrideInstalled.ok, true);

  const hockeyPlan = new BusinessOSCompiler().compile(hockeySpec, { nowISO: NOW });
  const hockeyDry = installer.dryRun({
    specification: hockeySpec,
    plan: hockeyPlan.plan,
    businessId: hockeyId,
    nowISO: NOW,
  });
  const hockeyApproval = createBusinessOSInstallationApproval({
    approvalId: "appr_hockey",
    businessId: hockeyId,
    specificationId: hockeySpec.specificationId,
    specificationVersion: hockeySpec.version,
    specificationContentHash: hockeySpec.contentHash,
    planId: hockeyPlan.plan.planId,
    planHash: hockeyPlan.plan.planHash,
    approvedByUserId: "owner_hockey",
  });
  const hockeyInstalled = installer.install({
    specification: hockeySpec,
    plan: hockeyPlan.plan,
    businessId: hockeyId,
    dryRunResult: hockeyDry,
    approval: hockeyApproval,
    nowISO: NOW,
  });
  assert.equal(hockeyInstalled.ok, true);
  assert.ok(hockeyInstalled.configuration.modules.some((module) => module.moduleId === "practices"));
  assert.ok(hockeyInstalled.configuration.roles.some((role) => role.roleId === "assistant_coach"));
  assert.ok(!JSON.stringify(hockeyInstalled.configuration).includes("HockeyRuntime"));
  assert.ok(!JSON.stringify(hockeyInstalled.configuration).includes("PropertyRuntime"));

  // Tenant isolation: installations are separate
  assert.notEqual(
    repository.getInstallation(mcbrideId).configuration.modules.map((module) => module.moduleId).join(","),
    repository.getInstallation(hockeyId).configuration.modules.map((module) => module.moduleId).join(","),
  );
  assert.equal(repository.getInstallation(mcbrideId).businessId, mcbrideId);
  assert.equal(repository.getInstallation(hockeyId).businessId, hockeyId);

  // Owner sees all; coach sees permitted modules
  const ownerAccess = resolveRoleAccess({
    specification: hockeySpec,
    configuration: hockeyInstalled.configuration,
    membershipRole: MEMBERSHIP_ROLES.OWNER,
    roleId: "club_owner",
  });
  assert.ok(ownerAccess.visibleModuleIds.includes("scouting"));
  assert.ok(ownerAccess.visibleModuleIds.includes("settings"));

  const coachAccess = resolveRoleAccess({
    specification: hockeySpec,
    configuration: hockeyInstalled.configuration,
    membershipRole: MEMBERSHIP_ROLES.MANAGER,
    roleId: "head_coach",
  });
  assert.ok(canAccessModule({ roleAccess: coachAccess, moduleId: "practices" }));
  assert.ok(canAccessModule({ roleAccess: coachAccess, moduleId: "drills" }));
  assert.equal(canAccessModule({ roleAccess: coachAccess, moduleId: "settings" }), false);

  const nav = buildBusinessOSNavigation({
    modules: hockeySpec.modules,
    navigation: { ...hockeySpec.navigation, primaryItems: [] },
    role: "coach",
    businessId: hockeyId,
    permissions: new Set(["work.view", "people.view"]),
  });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "practices" || item.label === "Practices"));
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "more") || nav.primaryItems.length <= 8);

  // Employee can request missing access via Work
  const accessStore = createInMemoryAccessRequestStore();
  const accessService = new AccessRequestService({ store: accessStore, nowISO: () => NOW });
  const request = await accessService.requestAccess({
    businessId: hockeyId,
    requesterUserId: "coach_assistant",
    requestKind: "module_access",
    requestedModuleId: "scouting",
    reason: "Need scouting reports for upcoming tournament",
    currentAccess: { modules: coachAccess.visibleModuleIds },
    approverUserId: "owner_hockey",
  });
  assert.equal(request.ok, true);
  assert.equal(request.workItem.workType, "access_request_approval");
  const decided = await accessService.decide({
    businessId: hockeyId,
    accessRequestId: request.accessRequest.accessRequestId,
    actorUserId: "owner_hockey",
    actorRole: MEMBERSHIP_ROLES.OWNER,
    decision: "approved",
  });
  assert.equal(decided.ok, true);

  // VIBETech admin enters under audited support access — isolated from McBride
  const supportStore = createInMemorySupportAccessStore({
    businesses: [
      { id: mcbrideId, name: "McBride" },
      { id: hockeyId, name: "Hockey Club" },
    ],
  });
  const support = new SupportAccessService({ store: supportStore, nowISO: () => NOW });
  const directory = support.listBusinessDirectory({
    adminUserId: "vt_admin",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(directory.ok, true);
  assert.equal(directory.businesses.length, 2);

  const enterHockey = await support.enter({
    adminUserId: "vt_admin",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: hockeyId,
    reason: "Help club owner configure scouting access",
    mode: "read_only",
  });
  assert.equal(enterHockey.ok, true);
  assert.equal(enterHockey.session.permanentMembershipGranted, false);

  const mcbrideSupport = await support.resolveAuthorization({
    adminUserId: "vt_admin",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: mcbrideId,
  });
  assert.equal(mcbrideSupport.ok, false);
  assert.equal(mcbrideSupport.reason, "support_access_required");

  const hockeySupport = await support.resolveAuthorization({
    adminUserId: "vt_admin",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: hockeyId,
  });
  assert.equal(hockeySupport.ok, true);
  assert.equal(hockeySupport.supportAccess.actorUserId, "vt_admin");

  const exited = await support.exit({ adminUserId: "vt_admin", businessId: hockeyId });
  assert.equal(exited.ok, true);
});
