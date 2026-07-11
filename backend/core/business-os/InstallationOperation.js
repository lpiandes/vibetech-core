import { createHash } from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const BUSINESS_OS_INSTALL_OPERATION_TYPES = Object.freeze([
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
  "INSTALL_ROLE",
  "CONFIGURE_PERMISSION",
  "CONFIGURE_ACCESS_REQUEST_POLICY",
  "CONFIGURE_SUPPORT_ACCESS_POLICY",
  "RECORD_DEFERRED_CAPABILITY",
  "REQUIRE_SETUP",
  "REQUIRE_PLATFORM_CAPABILITY",
  "REVIEW",
]);

export const OPERATION_STATUSES = Object.freeze([
  "pending",
  "applied",
  "noop",
  "deferred",
  "requires_setup",
  "recorded_gap",
  "failed",
  "skipped",
]);

export function stableInstallOperationId({ specificationId, specificationVersion, operationType, target }) {
  const raw = `${specificationId}|${specificationVersion}|${operationType}|${target}`;
  return `op_${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

/**
 * Single governed installation operation.
 * Aliases actionId/type for backward compatibility with existing plans.
 */
export function createInstallationOperation({
  specification,
  operationType,
  target,
  reason = "",
  label = null,
  explanation = null,
  dependencies = [],
  beforeState = null,
  afterState = null,
  risk = "low",
  reversible = true,
  status = "pending",
  requiresSetup = false,
  deferred = false,
  prohibited = false,
  payload = {},
} = {}) {
  if (!BUSINESS_OS_INSTALL_OPERATION_TYPES.includes(String(operationType))) {
    throw new Error(`InstallationOperation: unsupported operationType: ${operationType}`);
  }

  const version = specification.version ?? specification.specificationVersion;
  const operationId = stableInstallOperationId({
    specificationId: specification.specificationId,
    specificationVersion: version,
    operationType,
    target,
  });
  const actionId = `act_${createHash("sha256")
    .update(`${specification.specificationId}|${version}|${operationType}|${target}`)
    .digest("hex")
    .slice(0, 24)}`;

  const text = explanation ?? reason ?? label ?? operationType;

  return deepFreeze({
    operationId,
    actionId,
    operationType: String(operationType),
    type: String(operationType),
    target: String(target),
    targetId: String(target),
    reason: String(reason || text),
    label: label == null ? String(operationType) : String(label),
    explanation: String(text),
    dependencies: deepFreeze(Array.isArray(dependencies) ? dependencies.map(String) : []),
    beforeState: beforeState == null ? null : deepFreeze(beforeState),
    afterState: afterState == null ? null : deepFreeze(afterState),
    risk: String(risk),
    reversible: reversible !== false,
    status: String(status),
    requiresSetup: Boolean(requiresSetup),
    deferred: Boolean(deferred),
    prohibited: Boolean(prohibited),
    payload: deepFreeze(payload && typeof payload === "object" ? { ...payload } : {}),
  });
}
