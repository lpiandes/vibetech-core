function fail(message) {
  throw new Error(`AssignmentMapper: ${message}`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeWorkType(workType) {
  if (workType === null || workType === undefined) return "";
  return String(workType).trim().toLowerCase();
}

function extractWorkSnapshot(payload) {
  // Support both:
  // - Catalog shape: { work: { ... } }
  // - Sprint 4 shape: flattened payload fields (workItemId, title, workType, ...)
  if (!payload || typeof payload !== "object") return null;
  const asWork = payload.work ?? payload.workItem ?? payload;
  if (!asWork || typeof asWork !== "object") return null;
  return asWork;
}

function extractWorkItemId(work) {
  return work?.workItemId ?? work?.id ?? work?.workId ?? null;
}

export function mapWorkCreatedEventToAssignmentContext(event) {
  if (!event || typeof event !== "object") fail("event required.");
  const payload = event.payload ?? {};
  const work = extractWorkSnapshot(payload);
  if (!work) fail("WORK_CREATED payload.work (or flattened) required.");

  const workItemId = extractWorkItemId(work);
  if (!workItemId) fail("workItemId required.");

  const assignedTo = work?.assignedTo ?? work?.assigneeId ?? null;
  const workType = work?.workType ?? null;

  const occurredAt = event.occurredAt ?? event.timestampISO ?? work?.createdAt ?? null;
  const createdAtISO = occurredAt ? String(occurredAt) : null;

  return {
    workItemId: String(workItemId),
    assignedTo: assignedTo === null || assignedTo === undefined ? null : String(assignedTo),
    workType: workType === null || workType === undefined ? null : String(workType),
    createdAtISO,
  };
}

export function doesMemberMatchWorkType(member, workType) {
  const wt = normalizeWorkType(workType);
  if (!wt) return false;
  const roleId = safeString(member?.roleId).toLowerCase();
  const name = safeString(member?.name).toLowerCase();
  const skills = Array.isArray(member?.skills) ? member.skills.map((s) => String(s).toLowerCase()) : [];

  return roleId.includes(wt) || name.includes(wt) || skills.some((s) => s.includes(wt));
}

export function mapMemberToAssignee(member) {
  if (!member || typeof member !== "object") fail("member required.");
  if (!member.id) fail("member.id required.");
  const assigneeId = String(member.id);
  const assigneeType = String(member.memberType ?? "human");
  return { assigneeId, assigneeType };
}

export function deterministicAssignmentId({ workItemId, assigneeId }) {
  return `assign_${String(workItemId)}_${String(assigneeId)}`;
}

export function deterministicAssignmentEventId({ workItemId, assigneeId, assignedAtISO }) {
  return `evt_work_assigned_${String(workItemId)}_${String(assigneeId)}_${String(assignedAtISO ?? "na")}`;
}

