import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { APPROVAL_REQUEST_STATUSES } from "./ApprovalEventTypes.js";

function fail(message) {
  throw new Error(`ApprovalRequest: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createApprovalRequest({
  id,
  requestType,
  source,
  sourceReference,
  status,
  requestedAt,
  requestedBy,
  requiredApprover,
  context,
  decision,
  decidedAt,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(requestType, "requestType");
  requireString(source, "source");
  if (!isPlainObject(sourceReference)) fail("sourceReference required plain object.");
  if (!Object.values(APPROVAL_REQUEST_STATUSES).includes(String(status ?? ""))) {
    fail("status must be PENDING|GRANTED|REJECTED|CANCELLED.");
  }
  requireString(requestedAt, "requestedAt");
  requireString(requestedBy, "requestedBy");
  requireString(requiredApprover, "requiredApprover");
  if (!isPlainObject(context)) fail("context required plain object.");

  return deepFreeze({
    id: String(id),
    requestType: String(requestType),
    source: String(source),
    sourceReference: deepFreeze(sourceReference),
    status: String(status),
    requestedAt: String(requestedAt),
    requestedBy: String(requestedBy),
    requiredApprover: String(requiredApprover),
    context: deepFreeze(context),
    decision: decision === undefined || decision === null ? null : String(decision),
    decidedAt: decidedAt === undefined || decidedAt === null ? null : String(decidedAt),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
