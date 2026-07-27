import { createHash } from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Deterministic canonicalization for Business OS specifications.
 * Key order is sorted recursively so semantically equal specs hash identically.
 */
export function canonicalizeForHash(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeForHash(entry));
  }
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "contentHash" || key === "updatedAt" || key === "generatedAt" || key === "createdAt") {
        continue;
      }
      out[key] = canonicalizeForHash(value[key]);
    }
    return out;
  }
  return value;
}

export function extractHashableSpecificationContent(specification) {
  return canonicalizeForHash({
    schemaVersion: specification.schemaVersion,
    version: specification.version ?? specification.specificationVersion,
    businessProfile: specification.businessProfile,
    terminology: specification.terminology,
    modules: specification.modules,
    navigation: specification.navigation,
    subjectDefinitions: specification.subjectDefinitions,
    relationshipDefinitions: specification.relationshipDefinitions,
    requestDefinitions: specification.requestDefinitions,
    workDefinitions: specification.workDefinitions,
    pipelineDefinitions: specification.pipelineDefinitions,
    workflowDefinitions: specification.workflowDefinitions,
    employeeDefinitions: specification.employeeDefinitions,
    dashboardDefinitions: specification.dashboardDefinitions,
    campaignDefinitions: specification.campaignDefinitions,
    knowledgeRequirements: specification.knowledgeRequirements,
    integrationRequirements: specification.integrationRequirements,
    teamDefinitions: specification.teamDefinitions,
    teamAndAssignmentRules: specification.teamAndAssignmentRules,
    roleDefinitions: specification.roleDefinitions,
    permissionPolicies: specification.permissionPolicies,
    permissions: specification.permissions,
    accessRequestPolicies: specification.accessRequestPolicies,
    governancePolicies: specification.governancePolicies,
    readinessRequirements: specification.readinessRequirements,
    capabilityRequirements: specification.capabilityRequirements,
    unresolvedRequirements: specification.unresolvedRequirements,
    assumptions: specification.assumptions,
    capabilityGaps: specification.capabilityGaps,
  });
}

/**
 * Stable SHA-256 content hash. Validation must never mutate the input.
 */
export function hashBusinessOSSpecification(specification) {
  const payload = extractHashableSpecificationContent(specification);
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function hashInstallationPlan(plan) {
  const payload = canonicalizeForHash({
    planId: plan.planId,
    specificationId: plan.specificationId,
    specificationVersion: plan.specificationVersion,
    specificationContentHash: plan.specificationContentHash,
    actions: (plan.actions ?? plan.operations ?? []).map((action) => ({
      actionId: action.actionId ?? action.operationId,
      type: action.type ?? action.operationType,
      targetId: action.targetId ?? action.target,
    })),
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function assertHashUnchanged(beforeSpec, afterSpec) {
  const before = hashBusinessOSSpecification(beforeSpec);
  const after = hashBusinessOSSpecification(afterSpec);
  if (before !== after) {
    throw new Error("BusinessOSSpecificationHasher: validation mutated specification content.");
  }
  return deepFreeze({ before, after, unchanged: true });
}
