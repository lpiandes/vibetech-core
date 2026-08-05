import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { randomUUID } from "node:crypto";

/**
 * Canonical customer-requested responsibility — separate from chat, OCs, and gaps.
 * Raw request = what the customer wants. Operating Contract = what VIBETech agreed to operate.
 */

export const RESPONSIBILITY_REQUEST_STATUSES = Object.freeze([
  "draft",
  "pending_review",
  "confirmed",
  "clarifying",
  "proposed",
  "approved",
  "installing",
  "live",
  "blocked",
  "removed",
]);

export const IMPLEMENTATION_MODES = Object.freeze([
  "ready_existing_capabilities",
  "ready_after_customer_access",
  "ready_after_business_rules",
  "operator_assisted",
  "requires_reusable_capability",
  "unsupported_or_unsafe",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

/**
 * @param {Record<string, unknown>} input
 */
export function createResponsibilityRequest({
  responsibilityId = `resp_${randomUUID().slice(0, 12)}`,
  businessId = null,
  title = "",
  rawRequest = "",
  requestedOutcome = "",
  triggerDescription = "",
  actionDescription = "",
  affectedSubjects = "",
  systemsMentioned = [],
  frequency = "",
  volume = "",
  sla = "",
  approvalExpectations = "",
  successDescription = "",
  failureBehavior = "",
  requiredInformation = "",
  status = "draft",
  sourceAnswerIds = [],
  implementationMode = null,
  constraints = [],
  unresolvedFields = [],
  confidence = null,
  originalText = "",
  createdAt = new Date().toISOString(),
  updatedAt = null,
} = {}) {
  if (!RESPONSIBILITY_REQUEST_STATUSES.includes(String(status))) {
    throw new Error(`ResponsibilityRequest: unsupported status ${status}`);
  }
  if (implementationMode != null && !IMPLEMENTATION_MODES.includes(String(implementationMode))) {
    throw new Error(`ResponsibilityRequest: unsupported implementationMode ${implementationMode}`);
  }

  return deepFreeze({
    responsibilityId: String(responsibilityId),
    businessId: businessId == null ? null : String(businessId),
    title: asString(title, "Untitled responsibility"),
    rawRequest: asString(rawRequest || originalText),
    requestedOutcome: asString(requestedOutcome),
    triggerDescription: asString(triggerDescription),
    actionDescription: asString(actionDescription),
    affectedSubjects: asString(affectedSubjects),
    systemsMentioned: deepFreeze(asArray(systemsMentioned).map(String)),
    frequency: asString(frequency),
    volume: asString(volume),
    sla: asString(sla),
    approvalExpectations: asString(approvalExpectations),
    successDescription: asString(successDescription),
    failureBehavior: asString(failureBehavior),
    requiredInformation: asString(requiredInformation),
    status: String(status),
    sourceAnswerIds: deepFreeze(asArray(sourceAnswerIds).map(String)),
    implementationMode: implementationMode == null ? null : String(implementationMode),
    constraints: deepFreeze(asArray(constraints).map((c) => (
      c && typeof c === "object" ? deepFreeze({ ...c }) : c
    ))),
    unresolvedFields: deepFreeze(asArray(unresolvedFields).map(String)),
    confidence: confidence == null || Number.isNaN(Number(confidence)) ? null : Number(confidence),
    originalText: asString(originalText || rawRequest),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt ?? createdAt),
  });
}

export function patchResponsibilityRequest(request, patch = {}) {
  return createResponsibilityRequest({
    ...request,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export function listConfirmedResponsibilities(requests = []) {
  return asArray(requests).filter((r) => r && ["confirmed", "clarifying", "proposed", "approved", "installing", "live"].includes(String(r.status)));
}
