import { createHash } from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const BUSINESS_OS_INSTALL_ACTION_TYPES = Object.freeze([
  "INSTALL_INDUSTRY_PACKAGE",
  "ENABLE_CAPABILITY",
  "CONFIGURE_MODULE",
  "CONFIGURE_NAVIGATION",
  "REGISTER_SUBJECT_TYPE",
  "REGISTER_RELATIONSHIP_TYPE",
  "REGISTER_REQUEST_TYPE",
  "REGISTER_WORK_TYPE",
  "INSTALL_EMPLOYEE",
  "CONFIGURE_ASSIGNMENT_RULE",
  "INSTALL_DASHBOARD",
  "INSTALL_CAMPAIGN_TEMPLATE",
  "REGISTER_KNOWLEDGE_REQUIREMENT",
  "REGISTER_INTEGRATION_REQUIREMENT",
  "CONFIGURE_PERMISSION",
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
}) {
  return deepFreeze({
    actionId: stableInstallActionId({
      specificationId: specification.specificationId,
      specificationVersion: specification.specificationVersion,
      type,
      targetId,
    }),
    type,
    targetId: String(targetId),
    label,
    explanation,
    risk,
    requiresSetup,
    deferred,
    prohibited,
    payload: deepFreeze(payload),
  });
}

/**
 * Deterministic installation plan. Compilation never mutates business state.
 */
export function createBusinessOSInstallationPlan({
  planId,
  specification,
  actions = [],
  capabilityResolutions = [],
  warnings = [],
  risks = [],
  unresolvedQuestions = [],
  dryRun = true,
  createdAt = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    planId: String(planId),
    specificationId: specification.specificationId,
    specificationVersion: specification.specificationVersion,
    specificationContentHash: specification.contentHash,
    businessId: specification.businessId,
    dryRun: Boolean(dryRun),
    createdAt: String(createdAt),
    actions: deepFreeze(asArray(actions)),
    capabilityResolutions: deepFreeze(asArray(capabilityResolutions)),
    warnings: deepFreeze(asArray(warnings)),
    risks: deepFreeze(asArray(risks)),
    unresolvedQuestions: deepFreeze(asArray(unresolvedQuestions)),
    summary: deepFreeze({
      actionCount: asArray(actions).length,
      deferredCount: asArray(actions).filter((entry) => entry.deferred).length,
      setupRequiredCount: asArray(actions).filter((entry) => entry.requiresSetup).length,
      reviewCount: asArray(actions).filter((entry) => entry.type === "REVIEW").length,
    }),
  });
}

export { action as createInstallAction };
