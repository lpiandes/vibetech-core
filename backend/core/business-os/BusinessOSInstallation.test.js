import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessOSCompiler } from "./BusinessOSCompiler.js";
import { BusinessOSInstaller } from "./BusinessOSInstaller.js";
import { BusinessOSDryRunService } from "./BusinessOSDryRunService.js";
import { BusinessOSInstallationRepository } from "./BusinessOSInstallationRepository.js";
import {
  createBusinessOSInstallationApproval,
  validateInstallationApproval,
} from "./BusinessOSInstallationApproval.js";
import { createHockeyTravelClubSpecification } from "./fixtures/HockeyTravelClubSpecification.js";
import { createBusinessOSSpecification } from "./BusinessOSSpecification.js";
import { hashInstallationPlan } from "./BusinessOSSpecificationHasher.js";

const NOW = "2026-07-10T22:00:00.000Z";

test("approval is bound to specification hash and plan hash", () => {
  const spec = createHockeyTravelClubSpecification({ businessId: "biz_bind" });
  const compiled = new BusinessOSCompiler().compile(spec, { nowISO: NOW });
  assert.equal(compiled.ok, true);
  assert.ok(compiled.plan.planHash);

  const approval = createBusinessOSInstallationApproval({
    approvalId: "appr_1",
    businessId: "biz_bind",
    specificationId: spec.specificationId,
    specificationVersion: spec.version,
    specificationContentHash: spec.contentHash,
    planId: compiled.plan.planId,
    planHash: compiled.plan.planHash,
    approvedByUserId: "user_owner",
    approvedAt: NOW,
  });

  assert.equal(validateInstallationApproval({
    approval,
    specification: spec,
    plan: compiled.plan,
  }).ok, true);

  const changed = createBusinessOSSpecification({
    ...spec,
    specificationVersion: 2,
    version: 2,
    modules: [
      ...spec.modules,
      { moduleId: "extra", label: "Extra", moduleType: "analytics", primaryNavigationEligible: false },
    ],
  });
  const changedPlan = new BusinessOSCompiler().compile(changed, { nowISO: NOW }).plan;
  assert.equal(validateInstallationApproval({
    approval,
    specification: changed,
    plan: changedPlan,
  }).ok, false);
  assert.equal(validateInstallationApproval({
    approval,
    specification: changed,
    plan: changedPlan,
  }).reason, "stale_approval_specification_version");
});

test("installer rejects stale approval and supports restart after partial failure", () => {
  const repository = new BusinessOSInstallationRepository();
  const installer = new BusinessOSInstaller({ repository });
  const spec = createHockeyTravelClubSpecification({ businessId: "biz_restart" });
  const compiled = new BusinessOSCompiler().compile(spec, { nowISO: NOW });
  const dry = installer.dryRun({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_restart",
    nowISO: NOW,
  });
  assert.equal(dry.ok, true);
  assert.equal(dry.mutated, false);

  const staleApproval = createBusinessOSInstallationApproval({
    approvalId: "appr_stale",
    businessId: "biz_restart",
    specificationId: spec.specificationId,
    specificationVersion: spec.version,
    specificationContentHash: "not-the-real-hash",
    planId: compiled.plan.planId,
    planHash: compiled.plan.planHash,
    approvedByUserId: "user_owner",
  });
  const rejected = installer.install({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_restart",
    dryRunResult: dry,
    approval: staleApproval,
    nowISO: NOW,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "stale_approval_specification_hash");

  const approval = createBusinessOSInstallationApproval({
    approvalId: "appr_ok",
    businessId: "biz_restart",
    specificationId: spec.specificationId,
    specificationVersion: spec.version,
    specificationContentHash: spec.contentHash,
    planId: compiled.plan.planId,
    planHash: compiled.plan.planHash,
    approvedByUserId: "user_owner",
  });

  const failTarget = compiled.plan.actions.find((action) => action.type === "CONFIGURE_MODULE");
  const partial = installer.install({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_restart",
    dryRunResult: dry,
    approval,
    nowISO: NOW,
    failAtOperationId: failTarget.actionId,
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.reason, "partial_failure");
  assert.equal(repository.getInstallation("biz_restart").status, "failed");

  const resumed = installer.resume({
    specification: spec,
    plan: compiled.plan,
    businessId: "biz_restart",
    dryRunResult: dry,
    approval,
    nowISO: "2026-07-10T22:30:00.000Z",
  });
  assert.equal(resumed.ok, true);
  assert.ok(resumed.actionResults.some((entry) => entry.status === "noop"));
  assert.ok(resumed.configuration.roles.some((role) => role.roleId === "head_coach"));
  assert.ok(resumed.configuration.accessRequestPolicies.length >= 1);
  assert.ok(resumed.configuration.supportAccessPolicy);
});

test("dry-run service and plan hash are deterministic", () => {
  const repository = new BusinessOSInstallationRepository();
  const dryRunService = new BusinessOSDryRunService({ repository });
  const spec = createHockeyTravelClubSpecification({ businessId: "biz_dry" });
  const planA = new BusinessOSCompiler().compile(spec, { nowISO: NOW }).plan;
  const planB = new BusinessOSCompiler().compile(spec, { nowISO: NOW }).plan;
  assert.equal(planA.planHash, planB.planHash);
  assert.equal(planA.planHash, hashInstallationPlan(planA));

  const result = dryRunService.run({
    specification: spec,
    plan: planA,
    businessId: "biz_dry",
    nowISO: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(repository.getInstallation("biz_dry"), null);
  assert.ok(repository.getDryRun("biz_dry", planA.planId));
});

test("compiler emits role, access-request, and support-access operations", () => {
  const spec = createHockeyTravelClubSpecification();
  const compiled = new BusinessOSCompiler().compile(spec, { nowISO: NOW });
  const types = new Set(compiled.plan.actions.map((action) => action.type));
  assert.ok(types.has("INSTALL_ROLE"));
  assert.ok(types.has("CONFIGURE_ACCESS_REQUEST_POLICY"));
  assert.ok(types.has("CONFIGURE_SUPPORT_ACCESS_POLICY"));
  assert.ok(compiled.plan.operations.length === compiled.plan.actions.length);
});
