import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { REQUEST_STATUSES, isValidRequestStatus } from "./RequestStatus.js";

import { requireNonEmptyString as requirePriority } from "./RequestPriority.js";
import { requireNonEmptyString as requireChannel } from "./RequestChannel.js";
import { requireNonEmptyString as requireSource } from "./RequestSource.js";
import { requireNonEmptyString as requireRequestType } from "./RequestType.js";

function fail(message) {
  throw new Error(`Request: ${message}`);
}

function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} must be a non-empty string.`);
  return value;
}

function requireISOorNull(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(`${name} must be an ISO string or null.`);
  if (Number.isNaN(Date.parse(value))) fail(`${name} must be a valid ISO timestamp.`);
  return value;
}

function requireNullableString(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(`${name} must be string or null.`);
  return value;
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be a plain object.`);
  return value;
}

export function createRequest({
  id,
  title,
  description,
  requestType,
  status,
  priority,
  channel,
  source,
  requester,
  receivedAt,
  dueAt,
  assignedWorkId,
  assignedTeamMemberId,
  qualificationStatus,
  attachments,
  metadata,
} = {}) {
  requireNonEmptyString(id, "id");
  requireNonEmptyString(title, "title");
  requireNonEmptyString(description, "description");

  // requestType/status are central for downstream routing.
  requireRequestType(requestType, "requestType");
  if (!isValidRequestStatus(status)) fail(`status must be one of: ${REQUEST_STATUSES.join(", ")}`);

  requirePriority(priority, "priority");
  requireChannel(channel, "channel");
  requireSource(source, "source");
  requireNonEmptyString(requester, "requester");

  if (!receivedAt || typeof receivedAt !== "string") fail("receivedAt must be an ISO string.");
  if (Number.isNaN(Date.parse(receivedAt))) fail("receivedAt must be a valid ISO timestamp.");

  const req = {
    id: String(id),
    title: String(title),
    description: String(description),
    requestType: String(requestType),
    status: String(status),
    priority: String(priority),
    channel: String(channel),
    source: String(source),
    requester: String(requester),
    receivedAt: String(receivedAt),
    dueAt: requireISOorNull(dueAt, "dueAt"),
    assignedWorkId: requireNullableString(assignedWorkId, "assignedWorkId"),
    assignedTeamMemberId: requireNullableString(assignedTeamMemberId, "assignedTeamMemberId"),
    qualificationStatus: requireNullableString(qualificationStatus, "qualificationStatus"),
    attachments: Array.isArray(attachments) ? deepFreeze(attachments) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(req);
}

