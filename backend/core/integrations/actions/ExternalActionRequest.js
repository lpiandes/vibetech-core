import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const EXTERNAL_ACTION_STATUSES = {
  PENDING: "PENDING",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  BLOCKED: "BLOCKED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
};

function fail(message) {
  throw new Error(`ExternalActionRequest: ${message}`);
}

export function createExternalActionRequest({
  id,
  workspaceId,
  actionType,
  capability,
  providerId,
  connectionId,
  requestedBy,
  source,
  sourceReference,
  parameters,
  relatedObjects,
  requiresApproval,
  outboundApproved = false,
  requestedAt,
  idempotencyKey,
  metadata,
} = {}) {
  if (!id) fail("id required.");
  if (!workspaceId) fail("workspaceId required.");
  if (!capability) fail("capability required.");

  return deepFreeze({
    id: String(id),
    workspaceId: String(workspaceId),
    actionType: String(actionType ?? capability),
    capability: String(capability),
    providerId: providerId ? String(providerId) : null,
    connectionId: connectionId ? String(connectionId) : null,
    requestedBy: requestedBy ? String(requestedBy) : null,
    source: String(source ?? "system"),
    sourceReference: sourceReference ? String(sourceReference) : null,
    parameters: parameters && typeof parameters === "object" ? deepFreeze(parameters) : deepFreeze({}),
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    requiresApproval: Boolean(requiresApproval),
    outboundApproved: Boolean(outboundApproved),
    requestedAt: String(requestedAt ?? "2026-07-01T00:00:00.000Z"),
    idempotencyKey: idempotencyKey ? String(idempotencyKey) : String(id),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

export function createExternalActionResult({
  actionRequestId,
  status,
  providerId,
  connectionId,
  externalReference,
  startedAt,
  completedAt,
  error,
  retryable,
  metadata,
} = {}) {
  return deepFreeze({
    actionRequestId: String(actionRequestId ?? ""),
    status: String(status ?? EXTERNAL_ACTION_STATUSES.FAILED),
    providerId: providerId ? String(providerId) : null,
    connectionId: connectionId ? String(connectionId) : null,
    externalReference: externalReference ? String(externalReference) : null,
    startedAt: startedAt ?? null,
    completedAt: completedAt ?? null,
    error: error ? String(error) : null,
    retryable: Boolean(retryable),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}
