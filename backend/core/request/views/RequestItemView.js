import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`RequestItemView: ${message}`);
}

export function createRequestItemView({
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
  age,
  dueAt,
  qualificationStatus,
  assignedWorkId,
  assignedTeamMemberId,
  attentionRequired,
  nextAction,
  badges,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!description || typeof description !== "string") fail("description required.");
  if (!requestType || typeof requestType !== "string") fail("requestType required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!priority || typeof priority !== "string") fail("priority required.");
  if (!channel || typeof channel !== "string") fail("channel required.");
  if (!source || typeof source !== "string") fail("source required.");
  if (!requester || typeof requester !== "string") fail("requester required.");
  if (!receivedAt || typeof receivedAt !== "string") fail("receivedAt required.");

  const vm = {
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
    age: String(age ?? ""),
    dueAt: dueAt === undefined ? null : dueAt,
    qualificationStatus: qualificationStatus === undefined ? null : qualificationStatus,
    assignedWorkId: assignedWorkId === undefined ? null : assignedWorkId,
    assignedTeamMemberId: assignedTeamMemberId === undefined ? null : assignedTeamMemberId,
    attentionRequired: Boolean(attentionRequired),
    nextAction: nextAction === undefined ? null : nextAction,
    badges: Array.isArray(badges) ? deepFreeze(badges.map(String)) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

