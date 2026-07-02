import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { isValidRequestSource } from "./RequestSource.js";
import { isValidRequestType } from "./RequestType.js";
import { isValidRequestPriority } from "./RequestPriority.js";
import { isValidRequestStatus } from "./RequestStatus.js";
import { isValidRequestChannel } from "./RequestChannel.js";

function fail(message) {
  throw new Error(`Request: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

function requireISO(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required ISO string.`);
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) fail(`${name} invalid ISO string.`);
  return v;
}

function requireISOOrNull(v, name) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") fail(`${name} must be ISO string or null.`);
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) fail(`${name} invalid ISO string.`);
  return v;
}

function requireStringOrNull(v, name) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") fail(`${name} must be string or null.`);
  return v;
}

function requireAttachments(attachments) {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments)) fail("attachments must be array.");
  for (const a of attachments) {
    if (!a || typeof a !== "object" || Array.isArray(a)) fail("each attachment must be a plain object.");
  }
  return attachments;
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
  requireString(id, "id");
  requireString(title, "title");
  requireString(description, "description");
  requireString(requester, "requester");

  if (!isValidRequestType(requestType)) fail("requestType invalid.");
  if (!isValidRequestStatus(status)) fail("status invalid.");
  if (!isValidRequestPriority(priority)) fail("priority invalid.");
  if (!isValidRequestChannel(channel)) fail("channel invalid.");
  if (!isValidRequestSource(source)) fail("source invalid.");

  const receivedAtISO = requireISO(receivedAt, "receivedAt");
  const dueAtISO = requireISOOrNull(dueAt, "dueAt");

  const request = {
    id,
    title,
    description,
    requestType,
    status,
    priority,
    channel,
    source,
    requester,
    receivedAt: receivedAtISO,
    dueAt: dueAtISO,
    assignedWorkId: requireStringOrNull(assignedWorkId, "assignedWorkId"),
    assignedTeamMemberId: requireStringOrNull(assignedTeamMemberId, "assignedTeamMemberId"),
    qualificationStatus: requireStringOrNull(qualificationStatus, "qualificationStatus"),
    attachments: deepFreeze(requireAttachments(attachments)),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(request);
}

