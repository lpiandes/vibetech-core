import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

const CLOSED_WORK_STATUSES = new Set(["completed", "cancelled", "failed", "rejected"]);

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function toTime(iso) {
  if (!iso) return NaN;
  const ms = new Date(String(iso)).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function latestISO(values) {
  const times = values
    .filter(Boolean)
    .map((value) => ({ value: String(value), ms: toTime(value) }))
    .filter((entry) => Number.isFinite(entry.ms));
  if (!times.length) return null;
  times.sort((a, b) => b.ms - a.ms || a.value.localeCompare(b.value));
  return times[0].value;
}

function relationshipLabel(relationshipTypes, relationshipType) {
  const found = safeArray(relationshipTypes).find((entry) => String(entry.type) === String(relationshipType));
  return found?.label ? String(found.label) : String(relationshipType ?? "").replace(/_/g, " ");
}

function relationshipInvolvesParty(relationship, partyId) {
  const pid = String(partyId);
  return (
    (String(relationship?.fromEntity?.entityType) === ENTITY_TYPES.PARTY && String(relationship?.fromEntity?.entityId) === pid) ||
    (String(relationship?.toEntity?.entityType) === ENTITY_TYPES.PARTY && String(relationship?.toEntity?.entityId) === pid)
  );
}

function subjectIdFromRelationship(relationship, partyId) {
  if (!relationshipInvolvesParty(relationship, partyId)) return null;
  if (String(relationship?.fromEntity?.entityType) === ENTITY_TYPES.SUBJECT) return String(relationship.fromEntity.entityId);
  if (String(relationship?.toEntity?.entityType) === ENTITY_TYPES.SUBJECT) return String(relationship.toEntity.entityId);
  return null;
}

function requestIdFromRelationship(relationship, partyId) {
  if (!relationshipInvolvesParty(relationship, partyId)) return null;
  if (String(relationship?.fromEntity?.entityType) === ENTITY_TYPES.REQUEST) return String(relationship.fromEntity.entityId);
  if (String(relationship?.toEntity?.entityType) === ENTITY_TYPES.REQUEST) return String(relationship.toEntity.entityId);
  return null;
}

function collectPartyRequests({ partyId, relationships, requestRuntime }) {
  const requestIds = new Set();
  for (const relationship of safeArray(relationships)) {
    const requestId = requestIdFromRelationship(relationship, partyId);
    if (requestId) requestIds.add(requestId);
  }
  return safeArray(requestRuntime?.getRequests?.()).filter(
    (request) => requestIds.has(String(request.id)) || String(request.requester) === String(partyId),
  );
}

function collectPartySubjects({ partyId, relationships, requests, businessSubjectRuntime }) {
  const subjectIds = new Set();
  for (const relationship of safeArray(relationships)) {
    const subjectId = subjectIdFromRelationship(relationship, partyId);
    if (subjectId) subjectIds.add(subjectId);
  }
  for (const request of safeArray(requests)) {
    for (const ref of safeArray(request.subjectRefs)) {
      if (ref?.entityId) subjectIds.add(String(ref.entityId));
    }
  }
  return [...subjectIds].map((id) => businessSubjectRuntime?.getSubject?.(id)).filter(Boolean);
}

function latestQualification(requests) {
  const sorted = [...safeArray(requests)].sort((a, b) =>
    String(b?.receivedAt ?? b?.createdAt ?? "").localeCompare(String(a?.receivedAt ?? a?.createdAt ?? "")),
  );
  for (const request of sorted) {
    const qualification = request?.metadata?.qualification;
    if (isPlainObject(qualification) && Object.keys(qualification).length > 0) return qualification;
  }
  return {};
}

function interactionReferencesParty(interaction, partyId) {
  const pid = String(partyId);
  return safeArray(interaction?.participants).some((participant) => String(participant?.partyId) === pid);
}

function relationshipFollowUpInteractionMetadata(interaction) {
  const metadata = interaction?.metadata;
  return isPlainObject(metadata?.relationshipFollowUp) ? metadata.relationshipFollowUp : {};
}

function countsAsMeaningfulCustomerActivity(interaction) {
  const meta = relationshipFollowUpInteractionMetadata(interaction);
  if (meta?.activitySemantics?.meaningfulCustomerActivity === false) return false;
  return true;
}

function matchingFollowUpCommitment(interaction, { candidateId, relationshipType, ruleId, nowISO }) {
  if (!interaction?.followUpAt) return false;
  const meta = relationshipFollowUpInteractionMetadata(interaction);
  if (String(meta?.candidateId ?? "") !== String(candidateId)) return false;
  if (String(meta?.relationshipType ?? "") !== String(relationshipType)) return false;
  if (String(meta?.ruleId ?? "") !== String(ruleId)) return false;
  const due = toTime(interaction.followUpAt);
  const now = toTime(nowISO);
  return Number.isFinite(due) && Number.isFinite(now) && due > now;
}

function messageReferencesParty(message, partyId) {
  const pid = String(partyId);
  if (String(message?.sender?.id) === pid) return true;
  if (safeArray(message?.recipients).some((recipient) => String(recipient?.id) === pid)) return true;
  return safeArray(message?.relatedObjects).some(
    (ref) => String(ref?.entityType) === ENTITY_TYPES.PARTY && String(ref?.entityId) === pid,
  );
}

function messageActivityAt(message) {
  return latestISO([message?.createdAt, message?.sentAt, message?.deliveredAt, message?.failedAt]);
}

function isOpenWork(work) {
  return !CLOSED_WORK_STATUSES.has(String(work?.status ?? ""));
}

function relatedObjectsReferenceParty(work, partyId) {
  const pid = String(partyId);
  return safeArray(work?.relatedObjects).some(
    (ref) => String(ref?.entityType) === ENTITY_TYPES.PARTY && String(ref?.entityId) === pid,
  );
}

function relationshipFollowUpMetadata(work) {
  const metadata = work?.metadata;
  return isPlainObject(metadata?.relationshipFollowUp) ? metadata.relationshipFollowUp : {};
}

export function buildRelationshipFollowUpCandidateId({ partyId, relationshipType, ruleId } = {}) {
  return `relationship-followup:${String(partyId)}:${String(relationshipType)}:${String(ruleId)}`;
}

export function workMatchesRelationshipFollowUp({ work, candidateId, partyId, relationshipType, ruleId, targetWorkType } = {}) {
  if (String(work?.workType) !== String(targetWorkType)) return false;
  const meta = relationshipFollowUpMetadata(work);
  if (meta.candidateId && String(meta.candidateId) === String(candidateId)) return true;
  return (
    String(meta.ruleId ?? "") === String(ruleId) &&
    String(meta.relationshipType ?? "") === String(relationshipType) &&
    (String(work?.requestedBy ?? "") === String(partyId) || relatedObjectsReferenceParty(work, partyId))
  );
}

export function buildRelationshipFollowUpEvidence({
  businessGraphRuntime,
  requestRuntime,
  workRuntime,
  interactionRuntime,
  communicationRuntime,
  businessSubjectRuntime,
  communicationPreferenceRuntime,
  relationshipTypes,
  party,
  relationship,
  rule,
  nowISO,
} = {}) {
  const partyId = String(party?.id ?? "");
  const relationshipType = String(relationship?.relationshipType ?? "");
  const candidateId = buildRelationshipFollowUpCandidateId({ partyId, relationshipType, ruleId: rule?.id });
  const relationships = safeArray(businessGraphRuntime?.getRelationships?.());
  const requests = collectPartyRequests({ partyId, relationships, requestRuntime });
  const subjects = collectPartySubjects({ partyId, relationships, requests, businessSubjectRuntime });
  const qualification = latestQualification(requests);

  const operationalRequests = requests.filter((request) => String(request.requestType) !== "crm_import_profile");
  const interactions = safeArray(interactionRuntime?.getInteractions?.()).filter((interaction) =>
    interactionReferencesParty(interaction, partyId),
  );
  const operationalInteractions = interactions.filter((interaction) =>
    String(interaction.source ?? "") !== "crm_import" && countsAsMeaningfulCustomerActivity(interaction),
  );
  const importedNoteInteractions = interactions.filter((interaction) => String(interaction.source ?? "") === "crm_import");
  const futureFollowUpCommitments = interactions
    .filter((interaction) => matchingFollowUpCommitment(interaction, {
      candidateId,
      relationshipType,
      ruleId: rule?.id,
      nowISO,
    }))
    .sort((a, b) => String(a.followUpAt).localeCompare(String(b.followUpAt)));
  const messages = safeArray(communicationRuntime?.getMessages?.()).filter((message) => messageReferencesParty(message, partyId));

  const targetWorkType = rule?.targetWork?.workType;
  const matchingWork = safeArray(workRuntime?.getWorkItems?.()).filter((work) =>
    workMatchesRelationshipFollowUp({
      work,
      candidateId,
      partyId,
      relationshipType,
      ruleId: rule?.id,
      targetWorkType,
    }),
  );
  const openMatchingWork = matchingWork.filter(isOpenWork);
  const completedMatchingWork = matchingWork
    .filter((work) => String(work.status) === "completed" && work.completedAt)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));

  const latestCompletedMatchingWork = completedMatchingWork[0] ?? null;
  const latestMeaningfulActivityAt = latestISO([
    ...operationalRequests.map((request) => request.receivedAt),
    ...operationalInteractions.map((interaction) => interaction.occurredAt),
    ...messages.map(messageActivityAt),
    latestCompletedMatchingWork?.completedAt,
  ]);

  const emailCheck = checkCommunicationPermitted({
    preferenceRuntime: communicationPreferenceRuntime,
    partyId,
    channel: "email",
  });
  const smsCheck = checkCommunicationPermitted({
    preferenceRuntime: communicationPreferenceRuntime,
    partyId,
    channel: "sms",
  });

  const propertyInterest = qualification.propertyOfInterest ?? null;
  const primarySubject = subjects[0] ?? null;
  const relatedObjects = [
    createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
    primarySubject?.id ? createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(primarySubject.id) }) : null,
    requests[0]?.id ? createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: String(requests[0].id) }) : null,
  ].filter(Boolean);

  return {
    candidateId,
    partyId,
    displayName: String(party?.displayName ?? partyId),
    relationshipType,
    relationshipLabel: relationshipLabel(relationshipTypes, relationshipType),
    relationship: {
      id: String(relationship?.id ?? ""),
      status: String(relationship?.status ?? ""),
      effectiveTo: relationship?.effectiveTo ?? null,
    },
    qualification,
    qualificationCompleteness: {
      hasIntent: Boolean(qualification.intent),
      hasDecisionTimeline: Boolean(qualification.decisionTimeline),
      hasContactMethod: safeArray(party?.contactMethods).length > 0,
    },
    propertyInterest: primarySubject
      ? {
          source: "subject_linkage",
          value: String(primarySubject.displayName ?? primarySubject.id),
          subjectId: String(primarySubject.id),
          rawQualificationValue: propertyInterest ? String(propertyInterest) : null,
        }
      : propertyInterest
        ? { source: "qualification.propertyOfInterest", value: propertyInterest }
        : null,
    latestMeaningfulActivityAt,
    latestFutureFollowUpCommitment: futureFollowUpCommitments[0]
      ? {
          interactionId: String(futureFollowUpCommitments[0].id),
          followUpAt: String(futureFollowUpCommitments[0].followUpAt),
          outcome: futureFollowUpCommitments[0].outcome ?? null,
        }
      : null,
    importedNotes: importedNoteInteractions.map((interaction) => ({
      interactionId: String(interaction.id),
      noteCount: safeArray(interaction.notes).length,
      evidenceOnly: true,
    })),
    existingOpenWork: openMatchingWork[0] ?? null,
    latestCompletedMatchingWork,
    contactability: {
      email: { permitted: Boolean(emailCheck.permitted), reason: emailCheck.reason ?? null },
      sms: { permitted: Boolean(smsCheck.permitted), reason: smsCheck.reason ?? null },
    },
    relatedObjects,
  };
}

export function addDaysISO(iso, days) {
  const ms = toTime(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + Number(days ?? 0) * 24 * 60 * 60 * 1000).toISOString();
}

export function daysSince(iso, nowISO) {
  const then = toTime(iso);
  const now = toTime(nowISO);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return (now - then) / (24 * 60 * 60 * 1000);
}
