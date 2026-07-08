import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";

const CLOSED_WORK_STATUSES = new Set(["completed", "cancelled", "failed", "rejected"]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTime(value) {
  if (!value) return NaN;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function isOpenWork(work) {
  return !CLOSED_WORK_STATUSES.has(String(work?.status ?? ""));
}

function relationshipFollowUpMeta(value) {
  return isPlainObject(value?.metadata?.relationshipFollowUp) ? value.metadata.relationshipFollowUp : null;
}

function isRelationshipFollowUpWork(work) {
  return Boolean(relationshipFollowUpMeta(work));
}

function relationPartyId(relationship) {
  if (String(relationship?.fromEntity?.entityType) === ENTITY_TYPES.PARTY) return String(relationship.fromEntity.entityId);
  if (String(relationship?.toEntity?.entityType) === ENTITY_TYPES.PARTY) return String(relationship.toEntity.entityId);
  return null;
}

function relationSubjectId(relationship) {
  if (String(relationship?.fromEntity?.entityType) === ENTITY_TYPES.SUBJECT) return String(relationship.fromEntity.entityId);
  if (String(relationship?.toEntity?.entityType) === ENTITY_TYPES.SUBJECT) return String(relationship.toEntity.entityId);
  return null;
}

function increment(map, key, amount = 1) {
  const safeKey = String(key || "unknown");
  map.set(safeKey, (map.get(safeKey) ?? 0) + amount);
}

function topEntries(map, limit = 8) {
  return [...map.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function teamMemberName(teamRuntime, memberId) {
  const id = String(memberId ?? "");
  if (!id || id === "unassigned") return "Unassigned";
  const member = safeArray(teamRuntime?.getMembers?.()).find((entry) => String(entry.id) === id);
  return String(member?.name ?? id);
}

function partyName(businessGraphRuntime, partyId) {
  const party = businessGraphRuntime?.getParty?.(partyId);
  return String(party?.displayName ?? partyId);
}

function subjectName(businessSubjectRuntime, subjectId) {
  const subject = businessSubjectRuntime?.getSubject?.(subjectId);
  return String(subject?.displayName ?? subjectId);
}

function workHref(businessId, workId) {
  const bid = String(businessId ?? "");
  return bid && workId ? `/b/${bid}/work?workId=${encodeURIComponent(String(workId))}` : null;
}

function partyHref(businessId, partyId) {
  const bid = String(businessId ?? "");
  return bid && partyId ? `/b/${bid}/people/${encodeURIComponent(String(partyId))}` : null;
}

function subjectHref(businessId, subjectId) {
  const bid = String(businessId ?? "");
  return bid && subjectId ? `/b/${bid}/properties/${encodeURIComponent(String(subjectId))}` : null;
}

function metric(id, label, value, href = null) {
  return deepFreeze({ id, label, value: Number(value ?? 0), href });
}

function draftAssistanceMessages(communicationRuntime) {
  return safeArray(communicationRuntime?.getMessages?.()).filter(
    (message) => message?.metadata?.workAssistanceDraft?.assistanceType === "relationship_followup",
  );
}

function relationshipFollowUpInteractions(interactionRuntime) {
  return safeArray(interactionRuntime?.getInteractions?.()).filter((interaction) =>
    isPlainObject(interaction?.metadata?.relationshipFollowUp),
  );
}

export function buildRelationshipOperationsIntelligence({
  businessId,
  workRuntime,
  interactionRuntime,
  businessGraphRuntime,
  businessSubjectRuntime,
  communicationRuntime,
  teamRuntime,
  relationshipTypes = [],
  nowISO,
} = {}) {
  const generatedAt = String(nowISO ?? new Date().toISOString());
  const nowMs = toTime(generatedAt);
  const workItems = safeArray(workRuntime?.getWorkItems?.()).filter(isRelationshipFollowUpWork);
  const openWork = workItems.filter(isOpenWork);
  const completedWork = workItems.filter((work) => String(work.status) === "completed");
  const overdueWork = openWork.filter((work) => Number.isFinite(toTime(work.dueAt)) && toTime(work.dueAt) < nowMs);
  const draftMessages = draftAssistanceMessages(communicationRuntime);
  const interactions = relationshipFollowUpInteractions(interactionRuntime);

  const outcomeCounts = new Map();
  const noResponseByParty = new Map();
  const futureFollowUps = [];
  for (const interaction of interactions) {
    const meta = relationshipFollowUpMeta(interaction) ?? {};
    const outcomeId = String(meta.outcomeId ?? interaction.outcome ?? "");
    if (outcomeId) increment(outcomeCounts, outcomeId);
    const partyId = safeArray(interaction.participants).find((p) => p?.partyId)?.partyId ?? meta.partyId ?? null;
    if (outcomeId === "no_response" && partyId) increment(noResponseByParty, partyId);
    if (interaction.followUpAt && Number.isFinite(toTime(interaction.followUpAt)) && toTime(interaction.followUpAt) > nowMs) {
      futureFollowUps.push({
        interactionId: String(interaction.id),
        partyId: partyId ? String(partyId) : null,
        partyName: partyId ? partyName(businessGraphRuntime, String(partyId)) : null,
        followUpAt: String(interaction.followUpAt),
        outcomeId: outcomeId || null,
      });
    }
  }

  const propertyDemand = new Map();
  for (const relationship of safeArray(businessGraphRuntime?.getRelationships?.())) {
    if (String(relationship?.status) !== "active") continue;
    if (String(relationship?.relationshipType) !== "INTERESTED_IN") continue;
    const subjectId = relationSubjectId(relationship);
    if (!subjectId) continue;
    increment(propertyDemand, subjectId);
  }

  const relationshipTypeLabels = new Map(
    safeArray(relationshipTypes).map((entry) => [String(entry.type ?? entry.id ?? ""), String(entry.label ?? entry.type ?? entry.id ?? "")]),
  );
  const relationshipMix = new Map();
  for (const relationship of safeArray(businessGraphRuntime?.getRelationships?.())) {
    if (String(relationship?.status) !== "active") continue;
    if (String(relationship?.relationshipType) === "INTERESTED_IN") continue;
    if (!relationPartyId(relationship)) continue;
    increment(relationshipMix, String(relationship.relationshipType));
  }

  const assigneeWorkload = new Map();
  for (const work of openWork) {
    increment(assigneeWorkload, String(work.assignedTo ?? "unassigned"));
  }

  const oldOpenWork = openWork
    .map((work) => {
      const dueMs = toTime(work.dueAt);
      const createdMs = toTime(work.createdAt);
      const ageBasis = Number.isFinite(dueMs) ? dueMs : createdMs;
      const ageDays = Number.isFinite(ageBasis) && Number.isFinite(nowMs) ? Math.max(0, Math.floor((nowMs - ageBasis) / 86400000)) : null;
      const meta = relationshipFollowUpMeta(work) ?? {};
      const partyId = String(work.requestedBy ?? meta.partyId ?? "");
      return {
        workId: String(work.id),
        title: String(work.title ?? work.id),
        partyId: partyId || null,
        partyName: partyId ? partyName(businessGraphRuntime, partyId) : null,
        relationshipType: String(meta.relationshipType ?? ""),
        assignedTo: String(work.assignedTo ?? "unassigned"),
        assigneeName: teamMemberName(teamRuntime, work.assignedTo),
        dueAt: work.dueAt ?? null,
        ageDays,
        href: workHref(businessId, work.id),
      };
    })
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.title.localeCompare(b.title))
    .slice(0, 8);

  return deepFreeze({
    generatedAt,
    metrics: deepFreeze([
      metric("open_follow_up_work", "Open follow-up work", openWork.length, `/b/${businessId}/work`),
      metric("overdue_follow_up_work", "Overdue follow-ups", overdueWork.length, `/b/${businessId}/work`),
      metric("completed_follow_up_work", "Completed follow-ups", completedWork.length, `/b/${businessId}/work`),
      metric("drafts_prepared", "Drafts prepared", draftMessages.length, `/b/${businessId}/work`),
      metric("future_follow_up_commitments", "Future follow-up commitments", futureFollowUps.length, `/b/${businessId}/work`),
    ]),
    outcomeMix: deepFreeze(topEntries(outcomeCounts).map((entry) => deepFreeze({ ...entry, label: entry.id.replace(/_/g, " ") }))),
    repeatedNoResponse: deepFreeze(
      topEntries(noResponseByParty)
        .filter((entry) => entry.count >= 2)
        .map((entry) => deepFreeze({ ...entry, partyName: partyName(businessGraphRuntime, entry.id), href: partyHref(businessId, entry.id) })),
    ),
    propertyDemand: deepFreeze(
      topEntries(propertyDemand).map((entry) =>
        deepFreeze({ subjectId: entry.id, subjectName: subjectName(businessSubjectRuntime, entry.id), interestedCount: entry.count, href: subjectHref(businessId, entry.id) }),
      ),
    ),
    relationshipTypeDistribution: deepFreeze(
      topEntries(relationshipMix).map((entry) =>
        deepFreeze({ relationshipType: entry.id, label: relationshipTypeLabels.get(entry.id) ?? entry.id.replace(/_/g, " "), count: entry.count }),
      ),
    ),
    assigneeWorkload: deepFreeze(
      topEntries(assigneeWorkload).map((entry) =>
        deepFreeze({ assigneeId: entry.id, assigneeName: teamMemberName(teamRuntime, entry.id), openCount: entry.count }),
      ),
    ),
    oldOpenWork: deepFreeze(oldOpenWork.map((entry) => deepFreeze(entry))),
    futureFollowUps: deepFreeze(futureFollowUps.sort((a, b) => a.followUpAt.localeCompare(b.followUpAt)).slice(0, 8).map((entry) => deepFreeze(entry))),
    readOnly: true,
  });
}
