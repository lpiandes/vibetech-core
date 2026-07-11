import { createHash } from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const ACCESS_REQUEST_KINDS = Object.freeze([
  "module_access",
  "action_permission",
  "role_upgrade",
  "record_scope",
  "temporary_access",
]);

export const ACCESS_REQUEST_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
]);

function fail(message) {
  throw new Error(`AccessRequest: ${message}`);
}

/**
 * Canonical governed access request — never auto-approved.
 */
export function createAccessRequest({
  accessRequestId = null,
  businessId,
  requesterUserId,
  requestKind,
  requestedPermission = null,
  requestedModuleId = null,
  requestedRoleId = null,
  recordScope = null,
  reason,
  durationHours = null,
  currentAccess = {},
  riskLevel = "medium",
  approverUserId = null,
  status = "pending",
  createdAt = new Date().toISOString(),
  decidedAt = null,
  decisionNotes = null,
  workItemId = null,
  approvalRequestId = null,
  metadata = {},
} = {}) {
  if (!businessId) fail("businessId required.");
  if (!requesterUserId) fail("requesterUserId required.");
  if (!ACCESS_REQUEST_KINDS.includes(String(requestKind))) fail(`unsupported requestKind: ${requestKind}`);
  if (!reason || typeof reason !== "string") fail("reason required.");
  if (!ACCESS_REQUEST_STATUSES.includes(String(status))) fail(`unsupported status: ${status}`);

  const identitySeed = [
    businessId,
    requesterUserId,
    requestKind,
    requestedPermission ?? "",
    requestedModuleId ?? "",
    requestedRoleId ?? "",
    recordScope ?? "",
  ].join("|");

  const id = accessRequestId
    ?? `areq_${createHash("sha256").update(identitySeed).digest("hex").slice(0, 24)}`;

  return deepFreeze({
    accessRequestId: String(id),
    businessId: String(businessId),
    requesterUserId: String(requesterUserId),
    requestKind: String(requestKind),
    requestedPermission: requestedPermission == null ? null : String(requestedPermission),
    requestedModuleId: requestedModuleId == null ? null : String(requestedModuleId),
    requestedRoleId: requestedRoleId == null ? null : String(requestedRoleId),
    recordScope: recordScope == null ? null : String(recordScope),
    reason: String(reason),
    durationHours: durationHours == null ? null : Number(durationHours),
    currentAccess: deepFreeze(currentAccess && typeof currentAccess === "object" ? { ...currentAccess } : {}),
    riskLevel: String(riskLevel),
    approverUserId: approverUserId == null ? null : String(approverUserId),
    status: String(status),
    createdAt: String(createdAt),
    decidedAt: decidedAt == null ? null : String(decidedAt),
    decisionNotes: decisionNotes == null ? null : String(decisionNotes),
    workItemId: workItemId == null ? null : String(workItemId),
    approvalRequestId: approvalRequestId == null ? null : String(approvalRequestId),
    metadata: deepFreeze(metadata && typeof metadata === "object" ? { ...metadata } : {}),
  });
}

export function accessRequestOpenKey(request) {
  return [
    request.businessId,
    request.requesterUserId,
    request.requestKind,
    request.requestedPermission ?? "",
    request.requestedModuleId ?? "",
    request.requestedRoleId ?? "",
    request.recordScope ?? "",
  ].join("|");
}
