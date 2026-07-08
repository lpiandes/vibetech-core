import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../../references/EntityRef.js";
import { buildSubjectInterestSegmentCriteria } from "../buildSubjectInterestSegmentCriteria.js";
import { projectSegmentMembership } from "../SegmentProjectionEngine.js";
import { requestReferencesSubject as sharedRequestReferencesSubject } from "../../business-subject/views/subjectPortfolioSemantics.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function resolvePartyEmail(party) {
  const methods = safeArray(party?.contactMethods);
  const email = methods.find((m) => String(m).includes("@"));
  return email ? String(email) : null;
}

function resolvePartyPhone(party) {
  const methods = safeArray(party?.contactMethods);
  const phone = methods.find((m) => !String(m).includes("@") && /\d/.test(String(m)));
  return phone ? String(phone) : null;
}

function entityRefMatches(ref, entityType, entityId) {
  return String(ref?.entityType) === String(entityType) && String(ref?.entityId) === String(entityId);
}

function requestReferencesSubject(request, subjectId, businessSubjectRuntime) {
  return sharedRequestReferencesSubject(request, subjectId, businessSubjectRuntime);
}

function interactionReferencesSubject(interaction, subjectId) {
  return safeArray(interaction?.relatedObjects).some((ref) =>
    entityRefMatches(ref, ENTITY_TYPES.SUBJECT, subjectId),
  );
}

function partyParticipates(interaction, partyId) {
  return safeArray(interaction?.participants).some((p) => String(p.partyId) === String(partyId));
}

function latestIsoTimestamp(...values) {
  const times = values
    .filter(Boolean)
    .map((v) => new Date(String(v)).getTime())
    .filter((n) => !Number.isNaN(n));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function earliestIsoTimestamp(...values) {
  const times = values
    .filter(Boolean)
    .map((v) => new Date(String(v)).getTime())
    .filter((n) => !Number.isNaN(n));
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

function resolveOutcomeLabel(outcomeId, presentation) {
  const id = safeString(outcomeId);
  if (!id) return null;
  const outcomes = safeArray(presentation?.interactionOutcomes);
  const match = outcomes.find((o) => String(o.id) === id);
  return match?.displayName ? String(match.displayName) : id.replace(/_/g, " ");
}

function enrichAudienceMember({
  partyId,
  subjectId,
  subjectDisplayName,
  businessGraphRuntime,
  businessSubjectRuntime,
  requestRuntime,
  interactionRuntime,
  presentation,
}) {
  const party = businessGraphRuntime?.getParty?.(String(partyId)) ?? null;
  if (!party) return null;

  const interestedRelationship = safeArray(businessGraphRuntime?.getRelationships?.()).find(
    (rel) =>
      String(rel.relationshipType) === "INTERESTED_IN" &&
      entityRefMatches(rel.fromEntity, ENTITY_TYPES.PARTY, partyId) &&
      entityRefMatches(rel.toEntity, ENTITY_TYPES.SUBJECT, subjectId) &&
      !rel.effectiveTo &&
      String(rel.status ?? "active") === "active",
  );

  const subjectRequests = safeArray(requestRuntime?.getRequests?.())
    .filter(
      (r) =>
        String(r.requester) === String(partyId) &&
        requestReferencesSubject(r, subjectId, businessSubjectRuntime),
    )
    .sort((a, b) => String(a.receivedAt ?? "").localeCompare(String(b.receivedAt ?? "")));

  const subjectInteractions = safeArray(interactionRuntime?.getInteractions?.())
    .filter((i) => partyParticipates(i, partyId) && interactionReferencesSubject(i, subjectId))
    .sort((a, b) => String(a.occurredAt ?? "").localeCompare(String(b.occurredAt ?? "")));

  const latestRequest = subjectRequests.at(-1) ?? null;
  const latestInteraction = subjectInteractions.at(-1) ?? null;

  const sourceLabel =
    latestRequest?.inboundAttribution?.sourceLabel ??
    latestRequest?.source ??
    latestInteraction?.source ??
    null;

  const firstInterestAt = earliestIsoTimestamp(
    interestedRelationship?.effectiveFrom,
    subjectRequests[0]?.receivedAt,
    subjectInteractions[0]?.occurredAt,
  );

  const lastActivityAt = latestIsoTimestamp(
    latestRequest?.receivedAt,
    latestInteraction?.occurredAt,
    interestedRelationship?.updatedAt,
  );

  const latestOutcome = latestInteraction?.outcome ? String(latestInteraction.outcome) : null;

  const evidence = [];
  if (interestedRelationship) {
    evidence.push(
      deepFreeze({
        type: "INTERESTED_IN",
        label: `Interested in ${subjectDisplayName}`,
        occurredAt: interestedRelationship.effectiveFrom ? String(interestedRelationship.effectiveFrom) : null,
        requestId: null,
        interactionId: null,
      }),
    );
  }
  for (const req of subjectRequests) {
    evidence.push(
      deepFreeze({
        type: "REQUEST",
        label: `Inquiry${req.inboundAttribution?.sourceLabel ? ` via ${req.inboundAttribution.sourceLabel}` : ""}`,
        occurredAt: req.receivedAt ? String(req.receivedAt) : null,
        requestId: String(req.id),
        interactionId: null,
      }),
    );
  }

  return deepFreeze({
    partyId: String(partyId),
    displayName: String(party.displayName ?? partyId),
    email: resolvePartyEmail(party),
    phone: resolvePartyPhone(party),
    subjectDisplayName,
    firstInterestAt,
    lastActivityAt,
    sourceLabel: sourceLabel ? String(sourceLabel) : null,
    latestOutcome,
    latestOutcomeLabel: resolveOutcomeLabel(latestOutcome, presentation),
    latestRequestId: latestRequest ? String(latestRequest.id) : null,
    evidence: deepFreeze(evidence),
  });
}

/**
 * Industry-agnostic subject-scoped audience preview.
 * Membership: SegmentProjectionEngine with buildSubjectInterestSegmentCriteria.
 * Enrichment: display-only subject-scoped request/interaction/relationship evidence.
 */
export function buildSubjectAudiencePreview({
  subjectId,
  businessSubjectRuntime,
  businessGraphRuntime,
  requestRuntime,
  interactionRuntime,
  presentation = {},
  audienceExplanation = "People with recorded interest in this subject.",
  nowISO,
} = {}) {
  const sid = String(subjectId ?? "");
  if (!sid) return null;

  const subject = businessSubjectRuntime?.getSubject?.(sid) ?? null;
  if (!subject) return null;

  const criteria = buildSubjectInterestSegmentCriteria(sid);
  const projection = projectSegmentMembership({
    segmentDefinition: {
      id: `preview_subject_${sid}`,
      name: "Subject interest preview",
      targetEntityType: "Party",
      criteria,
    },
    businessGraphRuntime,
    requestRuntime,
    interactionRuntime,
    businessSubjectRuntime,
  });

  const subjectDisplayName = String(subject.displayName);
  const members = projection.members
    .map((member) =>
      enrichAudienceMember({
        partyId: member.entityId,
        subjectId: sid,
        subjectDisplayName,
        businessGraphRuntime,
        businessSubjectRuntime,
        requestRuntime,
        interactionRuntime,
        presentation,
      }),
    )
    .filter(Boolean)
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

  return deepFreeze({
    subject: deepFreeze({
      id: sid,
      displayName: subjectDisplayName,
      subjectType: String(subject.subjectType),
      status: String(subject.status),
      address: subject.keyAttributes?.address ? String(subject.keyAttributes.address) : null,
      keyAttributes: deepFreeze({ ...(subject.keyAttributes ?? {}) }),
    }),
    audience: deepFreeze({
      criteria,
      explanation: String(audienceExplanation),
      totalCount: members.length,
      members: deepFreeze(members),
    }),
    generatedAt: String(nowISO ?? new Date().toISOString()),
  });
}
