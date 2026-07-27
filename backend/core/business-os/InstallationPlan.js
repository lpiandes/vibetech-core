import { createHash } from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createInstallationOperation } from "./InstallationOperation.js";
import { hashInstallationPlan } from "./BusinessOSSpecificationHasher.js";

export const BUSINESS_OS_INSTALL_ACTION_TYPES = Object.freeze([
  "INSTALL_INDUSTRY_PACKAGE",
  "ENABLE_CAPABILITY",
  "CONFIGURE_MODULE",
  "CONFIGURE_NAVIGATION",
  "REGISTER_SUBJECT_TYPE",
  "REGISTER_RELATIONSHIP_TYPE",
  "REGISTER_REQUEST_TYPE",
  "REGISTER_WORK_TYPE",
  "INSTALL_PIPELINE",
  "INSTALL_WORKFLOW",
  "INSTALL_EMPLOYEE",
  "CONFIGURE_ASSIGNMENT_RULE",
  "INSTALL_DASHBOARD",
  "INSTALL_CAMPAIGN_TEMPLATE",
  "REGISTER_KNOWLEDGE_REQUIREMENT",
  "REGISTER_INTEGRATION_REQUIREMENT",
  "INSTALL_ROLE",
  "CONFIGURE_PERMISSION",
  "CONFIGURE_ACCESS_REQUEST_POLICY",
  "CONFIGURE_SUPPORT_ACCESS_POLICY",
  "RECORD_DEFERRED_CAPABILITY",
  "REQUIRE_SETUP",
  "REQUIRE_PLATFORM_CAPABILITY",
  "REVIEW",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function stableInstallActionId({ specificationId, specificationVersion, type, targetId }) {
  const raw = `${specificationId}|${specificationVersion}|${type}|${targetId}`;
  return `act_${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

function action({
  specification,
  type,
  targetId,
  label,
  explanation,
  risk = "low",
  requiresSetup = false,
  deferred = false,
  prohibited = false,
  payload = {},
  dependencies = [],
  reason = null,
}) {
  return createInstallationOperation({
    specification,
    operationType: type,
    target: targetId,
    label,
    explanation,
    reason: reason ?? explanation,
    risk,
    requiresSetup,
    deferred,
    prohibited,
    payload,
    dependencies,
  });
}

/**
 * Deterministic installation plan. Compilation never mutates business state.
 */
export function createBusinessOSInstallationPlan({
  planId,
  specification,
  actions = [],
  operations = null,
  capabilityResolutions = [],
  warnings = [],
  risks = [],
  unresolvedQuestions = [],
  dryRun = true,
  createdAt = new Date().toISOString(),
} = {}) {
  const resolvedActions = asArray(operations ?? actions);
  const plan = {
    planId: String(planId),
    specificationId: specification.specificationId,
    specificationVersion: specification.version ?? specification.specificationVersion,
    specificationContentHash: specification.contentHash,
    businessId: specification.businessId,
    dryRun: Boolean(dryRun),
    createdAt: String(createdAt),
    actions: deepFreeze(resolvedActions),
    operations: deepFreeze(resolvedActions),
    capabilityResolutions: deepFreeze(asArray(capabilityResolutions)),
    warnings: deepFreeze(asArray(warnings)),
    risks: deepFreeze(asArray(risks)),
    unresolvedQuestions: deepFreeze(asArray(unresolvedQuestions)),
    summary: deepFreeze({
      actionCount: resolvedActions.length,
      operationCount: resolvedActions.length,
      deferredCount: resolvedActions.filter((entry) => entry.deferred).length,
      setupRequiredCount: resolvedActions.filter((entry) => entry.requiresSetup).length,
      reviewCount: resolvedActions.filter((entry) => (entry.type ?? entry.operationType) === "REVIEW").length,
    }),
    planHash: null,
  };
  plan.planHash = hashInstallationPlan(plan);
  return deepFreeze(plan);
}

export { action as createInstallAction };
export { createInstallationOperation };

/** Alias for mission naming */
export { createBusinessOSInstallationPlan as createInstallationPlan };
