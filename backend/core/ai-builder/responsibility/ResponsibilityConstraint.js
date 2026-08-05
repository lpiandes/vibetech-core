import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { randomUUID } from "node:crypto";

export const CONSTRAINT_OWNERS = Object.freeze(["Customer", "VIBETech", "ThirdParty"]);

export const CONSTRAINT_TYPES = Object.freeze([
  "ACCOUNT_CONNECTION_REQUIRED",
  "AUTHORIZED_DATA_SOURCE_REQUIRED",
  "BUSINESS_RULE_REQUIRED",
  "KNOWLEDGE_REQUIRED",
  "HUMAN_OWNER_REQUIRED",
  "CONSENT_POLICY_REQUIRED",
  "PROVIDER_LIMITATION",
  "PLATFORM_CAPABILITY_REQUIRED",
  "THIRD_PARTY_APPROVAL_REQUIRED",
  "VOLUME_ECONOMIC_FEASIBILITY",
  "UNSUPPORTED_TRIGGER",
  "UNSUPPORTED_ACTION",
  "UNSUPPORTED_REQUEST",
  "CREDENTIAL_ACCESS_REQUIRED",
  "MISSING_DATA_SOURCE",
]);

export const BLOCKING_SCOPES = Object.freeze([
  "action",
  "responsibility",
  "outbound",
  "installation",
]);

export const CONSTRAINT_STATUSES = Object.freeze([
  "open",
  "in_progress",
  "resolved",
  "accepted_fallback",
  "wont_fix",
]);

/**
 * First-class constraint — never a vague checklist sentence.
 */
export function createResponsibilityConstraint({
  constraintId = `cstr_${randomUUID().slice(0, 12)}`,
  responsibilityId = null,
  type = "BUSINESS_RULE_REQUIRED",
  description = "",
  owner = "Customer",
  resolutionAction = "",
  blockingScope = "responsibility",
  evidenceNeeded = "",
  status = "open",
  resolvedAt = null,
  proofReference = null,
  fallback = null,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!CONSTRAINT_TYPES.includes(String(type))) {
    throw new Error(`ResponsibilityConstraint: unsupported type ${type}`);
  }
  if (!CONSTRAINT_OWNERS.includes(String(owner))) {
    throw new Error(`ResponsibilityConstraint: unsupported owner ${owner}`);
  }
  if (!BLOCKING_SCOPES.includes(String(blockingScope))) {
    throw new Error(`ResponsibilityConstraint: unsupported blockingScope ${blockingScope}`);
  }
  if (!CONSTRAINT_STATUSES.includes(String(status))) {
    throw new Error(`ResponsibilityConstraint: unsupported status ${status}`);
  }

  return deepFreeze({
    constraintId: String(constraintId),
    responsibilityId: responsibilityId == null ? null : String(responsibilityId),
    type: String(type),
    description: String(description ?? "").trim(),
    owner: String(owner),
    resolutionAction: String(resolutionAction ?? "").trim(),
    blockingScope: String(blockingScope),
    evidenceNeeded: String(evidenceNeeded ?? "").trim(),
    status: String(status),
    resolvedAt: resolvedAt == null ? null : String(resolvedAt),
    proofReference: proofReference == null ? null : String(proofReference),
    fallback: fallback == null ? null : deepFreeze({ ...fallback }),
    createdAt: String(createdAt),
  });
}
