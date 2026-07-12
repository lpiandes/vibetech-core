import assert from "node:assert/strict";
import { test, before } from "node:test";

import {
  ArchitectChangeCapabilityRegistry,
  resetDefaultArchitectChangeCapabilityRegistryForTests,
} from "./ArchitectChangeCapabilityRegistry.js";
import { createArchitectChangeCapabilityDefinition } from "./ArchitectChangeCapabilityDefinition.js";
import { registerDefaultArchitectChangeCapabilities, resetArchitectChangeCapabilityRegistrationForTests } from "./registerDefaultArchitectChangeCapabilities.js";
import { matchArchitectChangeRequest } from "./matchArchitectChangeRequest.js";
import { ArchitectChangeCapabilityRunner } from "./ArchitectChangeCapabilityRunner.js";
import { createMutationOperation, createMutationPlan, validateMutationPlan } from "./MutationPlan.js";
import { MutationPlanExecutor } from "./MutationPlanExecutor.js";
import { contributeArchitectChangeCapabilities } from "./packageContribution.js";
import { createBuilderSession } from "../BuilderSession.js";
import { BuilderAssemblyPlanner } from "../BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "../BuilderSpecificationAssembler.js";
import { BuilderChangeProposalService } from "../BuilderChangeProposalService.js";
import { MUTATION_OPERATION_TYPES } from "./MutationOperationTypes.js";

function sampleSpec() {
  const session = createBuilderSession({
    businessSummary: { businessName: "Bright Smile", industry: "dental" },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  return new BuilderSpecificationAssembler().assemble({ session, assemblyPlan: plan }).specification;
}

before(() => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
});

test("capability registration validation rejects duplicates and invalid defs", () => {
  const registry = new ArchitectChangeCapabilityRegistry();
  const base = {
    capabilityId: "architect.change.test_only",
    version: "1.0.0",
    title: "Test",
    description: "Test capability",
    requestPatterns: [{ id: "t", examples: ["test change"], keywords: ["testchangeunique"] }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: { fields: [] },
    mutationPlanTemplate: {
      operations: [{
        operationType: "updateBusinessProfile",
        targetType: "business_profile",
        payload: { businessName: "X" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["business_profile"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["profile"],
    approvalPolicy: { requiresDryRun: true, requiresHumanApproval: true, bindsContentHash: true },
    auditEventTypes: {
      interpreted: "architect.change_interpreted",
      proposed: "architect.change_proposed",
      approved: "architect.change_approved",
      executed: "architect.change_executed",
      failed: "architect.change_failed",
      rejected: "architect.change_rejected",
      needsInformation: "architect.change_needs_information",
      ambiguous: "architect.change_ambiguous",
      unsupported: "architect.change_unsupported",
      executionStarted: "architect.change_execution_started",
    },
  };
  registry.register(base);
  assert.throws(() => registry.register(base), /duplicate/);
  assert.throws(
    () => createArchitectChangeCapabilityDefinition({ ...base, capabilityId: null }),
    /capabilityId required/,
  );
  assert.throws(
    () => createArchitectChangeCapabilityDefinition({
      ...base,
      capabilityId: "bad_op",
      mutationPlanTemplate: {
        operations: [{
          operationType: "not_a_real_op",
          targetType: "business_profile",
          allowsExternalCommunication: false,
        }],
      },
    }),
    /unknown operationType/,
  );
});

test("defaults register and match legacy intents deterministically", () => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
  const rename = registry.match("Rename Patients to Clients");
  assert.equal(rename.status, "matched");
  assert.equal(rename.legacyKind, "terminology_rename");
  const hire = registry.match("We hired another leasing agent");
  assert.equal(hire.status, "matched");
  assert.equal(hire.legacyKind, "add_employee");
});

test("unsupported and ambiguous matching outcomes", () => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
  const unsupported = matchArchitectChangeRequest({
    text: "Buy an autonomous drone inspection fleet for my rooftops",
    capabilities: registry.list(),
  });
  assert.equal(unsupported.status, "unsupported");
  assert.ok(unsupported.recommendation);

  // Force ambiguity by registering two near-identical capabilities
  const local = new ArchitectChangeCapabilityRegistry();
  const mk = (id, keywords) => ({
    capabilityId: id,
    version: "1.0.0",
    title: id,
    description: id,
    requestPatterns: [{ id: "p", examples: ["flip the switch now"], keywords, weight: 2 }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: { fields: [] },
    mutationPlanTemplate: {
      operations: [{
        operationType: "appendUnresolvedRequirement",
        targetType: "unresolved_requirement",
        payload: { question: "x" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: [],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["profile"],
    approvalPolicy: { requiresDryRun: true, requiresHumanApproval: true, bindsContentHash: true },
    auditEventTypes: {
      interpreted: "a", proposed: "a", approved: "a", executed: "a", failed: "a",
      rejected: "a", needsInformation: "a", ambiguous: "a", unsupported: "a", executionStarted: "a",
    },
    matchPriority: 100,
  });
  local.register(mk("architect.change.amb_a", ["flip", "switch"]));
  local.register(mk("architect.change.amb_b", ["flip", "switch"]));
  const amb = local.match("please flip the switch for me");
  assert.equal(amb.status, "ambiguous");
});

test("mutation plan executor is idempotent and denies missing permissions", () => {
  const spec = sampleSpec();
  const plan = createMutationPlan({
    capabilityId: "architect.change.add_module",
    businessId: spec.businessId,
    operations: [createMutationOperation({
      operationType: "addModule",
      targetType: "module",
      payload: { label: "Referrals" },
      requiredPermission: "business.manage",
      affectedRuntimeKinds: ["modules"],
      allowsExternalCommunication: false,
    })],
  });
  validateMutationPlan(plan);
  const executor = new MutationPlanExecutor();
  const first = executor.applyToSpecification({
    specification: spec,
    plan,
    actorPermissions: ["business.manage"],
    actorBusinessId: spec.businessId,
  });
  assert.equal(first.ok, true);
  const second = executor.applyToSpecification({
    specification: first.nextSpecification,
    plan,
    actorPermissions: ["business.manage"],
    actorBusinessId: spec.businessId,
  });
  assert.equal(second.ok, true);
  assert.equal(
    first.nextSpecification.modules.filter((m) => m.moduleId === "referrals").length,
    second.nextSpecification.modules.filter((m) => m.moduleId === "referrals").length,
  );

  const denied = executor.applyToSpecification({
    specification: spec,
    plan,
    actorPermissions: ["work.view"],
    actorBusinessId: spec.businessId,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "permission_denied");

  const tenant = executor.applyToSpecification({
    specification: spec,
    plan: { ...plan, businessId: "other_biz" },
    actorPermissions: ["business.manage"],
    actorBusinessId: "biz_a",
  });
  assert.equal(tenant.ok, false);
  assert.equal(tenant.reason, "tenant_scope_mismatch");
});

test("stale-state detection and external communication guard", () => {
  const spec = sampleSpec();
  const executor = new MutationPlanExecutor();
  const stalePlan = createMutationPlan({
    capabilityId: "architect.change.update_business_profile",
    operations: [createMutationOperation({
      operationType: "updateBusinessProfile",
      targetType: "business_profile",
      expectedCurrentState: { version: 999 },
      payload: { businessName: "Nope" },
      requiredPermission: "business.manage",
      affectedRuntimeKinds: ["business_profile"],
      allowsExternalCommunication: false,
    })],
  });
  const stale = executor.applyToSpecification({
    specification: spec,
    plan: stalePlan,
    actorPermissions: ["*"],
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale_state");

  assert.throws(
    () => validateMutationPlan(createMutationPlan({
      capabilityId: "x",
      operations: [createMutationOperation({
        operationType: "updateBusinessProfile",
        targetType: "business_profile",
        payload: {},
        allowsExternalCommunication: true,
        requiredPermission: "business.manage",
        affectedRuntimeKinds: [],
      })],
    })),
    /external communication/,
  );
  assert.ok(MUTATION_OPERATION_TYPES.includes("inviteMembership"));
});

test("runner needs_information resume and proposal service preserves hire behavior", async () => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
  const runner = new ArchitectChangeCapabilityRunner({ registry });
  const session = createBuilderSession({
    businessId: "biz_1",
    businessSummary: { businessName: "Bright Smile", industry: "dental" },
  });
  const specification = sampleSpec();

  // Force missing info: capability that requires email
  const need = runner.run({
    session,
    specification,
    text: "Invite a teammate please",
    selectCapabilityId: "architect.change.invite_team_member",
  });
  assert.equal(need.status, "needs_information");
  assert.ok(need.missing.some((field) => field.id === "email"));

  const resumed = runner.run({
    session: {
      ...session,
      metadata: {
        pendingChange: {
          status: "needs_information",
          capabilityId: "architect.change.invite_team_member",
          values: {},
        },
      },
    },
    specification,
    text: "jordan@example.com as manager",
    priorValues: {},
    selectCapabilityId: "architect.change.invite_team_member",
  });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.status, "matched");
  assert.ok(resumed.sideEffects.some((op) => op.operationType === "inviteMembership"));
  assert.equal(resumed.sideEffects[0].allowsExternalCommunication, true);

  const service = new BuilderChangeProposalService({ registry });
  const hired = await service.propose({
    session,
    specification,
    text: "We hired another leasing agent",
  });
  assert.equal(hired.ok, true);
  assert.equal(hired.request.interpreted.kind, "add_employee");
  assert.equal(hired.requiresDryRun, true);
  assert.ok((hired.nextSpecification.employeeDefinitions ?? []).length
    >= (specification.employeeDefinitions ?? []).length);
});

test("package contribution adds capability without editing Architect core modules", () => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
  contributeArchitectChangeCapabilities({
    source: "package:example_vertical",
    vocabulary: [{
      synonyms: ["squad hub"],
      examples: ["Stand up a squad hub workspace"],
    }],
    capabilities: [{
      capabilityId: "architect.change.package_squad_hub",
      version: "1.0.0",
      title: "Squad hub",
      description: "Package-provided workspace capability",
      requestPatterns: [{
        id: "squad",
        examples: ["Stand up a squad hub workspace"],
        keywords: ["squad hub"],
        weight: 3,
      }],
      requiredPermissions: ["business.manage"],
      requiredInformationSchema: { fields: [] },
      mutationPlanTemplate: {
        operations: [{
          operationType: "addModule",
          targetType: "module",
          payload: { label: "Squad Hub" },
          requiredPermission: "business.manage",
          affectedRuntimeKinds: ["modules"],
          allowsExternalCommunication: false,
        }],
      },
      affectedCanonicalAreas: ["modules"],
      approvalPolicy: { requiresDryRun: true, requiresHumanApproval: true, bindsContentHash: true },
      auditEventTypes: {
        interpreted: "architect.change_interpreted",
        proposed: "architect.change_proposed",
        approved: "architect.change_approved",
        executed: "architect.change_executed",
        failed: "architect.change_failed",
        rejected: "architect.change_rejected",
        needsInformation: "architect.change_needs_information",
        ambiguous: "architect.change_ambiguous",
        unsupported: "architect.change_unsupported",
        executionStarted: "architect.change_execution_started",
      },
      packageAvailability: {
        defaultEnabled: true,
        industryPackageIds: ["example_vertical"],
      },
    }],
  });
  const match = registry.match("Stand up a squad hub workspace");
  assert.equal(match.status, "matched");
  assert.equal(match.capabilityId, "architect.change.package_squad_hub");
  assert.equal(registry.get("architect.change.package_squad_hub")._source, "package:example_vertical");
});

test("unsupported propose does not mutate specification", async () => {
  const registry = resetDefaultArchitectChangeCapabilityRegistryForTests();
  resetArchitectChangeCapabilityRegistrationForTests(registry);
  const service = new BuilderChangeProposalService({ registry });
  const session = createBuilderSession({ businessId: "biz_1" });
  const specification = sampleSpec();
  const before = specification.contentHash;
  const result = await service.propose({
    session,
    specification,
    text: "Spin up a private drone delivery network for residents",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(specification.contentHash, before);
});
