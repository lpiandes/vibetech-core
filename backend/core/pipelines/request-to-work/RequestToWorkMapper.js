import { DEFAULT_WORK_ITEM_STATUS, DEFAULT_WORK_STAGE_ID, DEFAULT_WORK_QUEUE_ID } from "./RequestToWorkDefaults.js";

function fail(message) {
  throw new Error(`RequestToWorkMapper: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireOptionalStringOrNull(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(`${name} must be string or null.`);
  return value;
}

export function mapRequestConvertedToWorkItemInput(payload = {}) {
  // Payload fields come from REQUEST_CONVERTED contract.
  const requestId = requireString(payload.requestId, "payload.requestId");
  const title = requireString(payload.title, "payload.title");
  const description = requireString(payload.description, "payload.description");
  const requestType = requireString(payload.requestType, "payload.requestType");
  const priority = requireString(payload.priority, "payload.priority");
  const channel = requireString(payload.channel, "payload.channel");
  const source = requireString(payload.source, "payload.source");
  const requester = requireString(payload.requester, "payload.requester");

  const convertedAt = requireOptionalStringOrNull(payload.convertedAt, "payload.convertedAt") ?? null;
  if (convertedAt === null) fail("payload.convertedAt required for deterministic createdAt/updatedAt.");

  const assignedTeamMemberId = requireOptionalStringOrNull(payload.assignedTeamMemberId, "payload.assignedTeamMemberId");

  // Deterministic work id derived from request.
  const workId = `work_${requestId}`;

  // Work inputs follow the canonical WorkItem contract requirements.
  return {
    id: workId,
    title,
    description,
    workType: requestType,
    status: DEFAULT_WORK_ITEM_STATUS,
    priority,
    stageId: DEFAULT_WORK_STAGE_ID,
    queueId: DEFAULT_WORK_QUEUE_ID,
    assignedTo: assignedTeamMemberId ? String(assignedTeamMemberId) : "unassigned",
    requestedBy: requester,
    source: source,
    // Use convertedAt as deterministic creation/update time.
    createdAt: convertedAt,
    updatedAt: convertedAt,
    dueAt: null,
    completedAt: null,
    blockedReason: null,
    relatedObjects: deepFreeze([String(requestId)]),
    requirements: [],
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    // channel is not directly used by WorkItem contract; included via metadata for traceability.
    metadataTrace: deepFreeze({ channel }),
  };
}

// Local deepFreeze helper (keeps mapper pure + deterministic).
function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

