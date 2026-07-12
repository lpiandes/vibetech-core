import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createHash, randomUUID } from "node:crypto";
import {
  assertKnownMutationOperationType,
  MUTATION_TARGET_TYPES,
} from "./MutationOperationTypes.js";

function fail(message) {
  throw new Error(`MutationPlan: ${message}`);
}

/**
 * Single universal mutation operation — declarative, auditable, non-communicating by default.
 */
export function createMutationOperation({
  operationId = `mop_${randomUUID().slice(0, 10)}`,
  operationType,
  targetType,
  targetId = null,
  targetSelector = null,
  expectedCurrentState = null,
  payload = {},
  reason = null,
  evidence = [],
  requiredPermission = "business.manage",
  affectedRuntimeKinds = [],
  idempotencyKey = null,
  allowsExternalCommunication = false,
} = {}) {
  assertKnownMutationOperationType(operationType);
  if (!targetType) fail("targetType required.");
  if (!MUTATION_TARGET_TYPES.includes(String(targetType)) && String(targetType) !== "business_os_specification") {
    // Allow known targets; unknown still fail closed for safety.
    if (!MUTATION_TARGET_TYPES.includes(String(targetType))) {
      fail(`unsupported targetType: ${targetType}`);
    }
  }
  if (allowsExternalCommunication !== false && allowsExternalCommunication !== true) {
    fail("allowsExternalCommunication must be boolean.");
  }
  // Invariant: silent external communication is prohibited unless explicitly flagged
  // AND the capability approval policy allows it (enforced by runner/executor).
  const key = idempotencyKey
    ?? createHash("sha256")
      .update(JSON.stringify({
        operationType,
        targetType,
        targetId,
        targetSelector,
        payload,
      }))
      .digest("hex")
      .slice(0, 24);

  return deepFreeze({
    operationId: String(operationId),
    operationType: String(operationType),
    targetType: String(targetType),
    targetId: targetId == null ? null : String(targetId),
    targetSelector: targetSelector == null ? null : deepFreeze(targetSelector),
    expectedCurrentState: expectedCurrentState == null ? null : deepFreeze(expectedCurrentState),
    payload: deepFreeze(payload && typeof payload === "object" ? { ...payload } : {}),
    reason: reason == null ? null : String(reason),
    evidence: deepFreeze(Array.isArray(evidence) ? evidence.map(String) : []),
    requiredPermission: String(requiredPermission ?? "business.manage"),
    affectedRuntimeKinds: deepFreeze(
      (Array.isArray(affectedRuntimeKinds) ? affectedRuntimeKinds : []).map(String),
    ),
    idempotencyKey: String(key),
    allowsExternalCommunication: Boolean(allowsExternalCommunication),
  });
}

export function createMutationPlan({
  planId = `mplan_${randomUUID().slice(0, 10)}`,
  capabilityId,
  businessId = null,
  operations = [],
  summary = null,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!capabilityId) fail("capabilityId required.");
  if (!Array.isArray(operations) || operations.length === 0) {
    fail("operations required (non-empty).");
  }
  const frozenOps = operations.map((op) => (
    op?.operationType ? createMutationOperation(op) : fail("invalid operation")
  ));
  if (frozenOps.some((op) => op.allowsExternalCommunication)) {
    // Explicit ops may allow governed invitation delivery — never silent send.
  }
  return deepFreeze({
    planId: String(planId),
    capabilityId: String(capabilityId),
    businessId: businessId == null ? null : String(businessId),
    operations: frozenOps,
    summary: summary == null ? null : String(summary),
    createdAt: String(createdAt),
    contentHash: createHash("sha256")
      .update(JSON.stringify(frozenOps.map((op) => ({
        operationType: op.operationType,
        targetType: op.targetType,
        targetId: op.targetId,
        payload: op.payload,
        idempotencyKey: op.idempotencyKey,
      }))))
      .digest("hex"),
  });
}

export function validateMutationPlan(plan) {
  if (!plan?.planId || !plan?.capabilityId) fail("planId and capabilityId required.");
  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    fail("operations required.");
  }
  for (const op of plan.operations) {
    assertKnownMutationOperationType(op.operationType);
    if (op.allowsExternalCommunication && op.operationType !== "inviteMembership") {
      fail(`external communication not allowed for ${op.operationType}`);
    }
  }
  return deepFreeze(plan);
}
