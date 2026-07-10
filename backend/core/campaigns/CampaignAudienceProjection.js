import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

const RELATIONSHIP_MARKETING_RELATIONSHIP_TYPES = new Set([
  "PROSPECT",
  "BUYER",
  "SELLER_PROSPECT",
  "SELLER",
  "PAST_BUYER",
  "PAST_SELLER",
  "OWNER",
  "INVESTOR",
  "REFERRAL_SOURCE",
]);

function partyEmail(party) {
  return safeArray(party?.contactMethods).map(String).find((method) => method.includes("@")) ?? null;
}

function relationshipTypesForParty({ businessGraphRuntime, partyId }) {
  const pid = String(partyId);
  return safeArray(businessGraphRuntime?.getRelationships?.())
    .filter(
      (rel) =>
        String(rel?.status ?? "active") === "active" &&
        String(rel?.relationshipType ?? "") !== "REQUESTED_BY" &&
        (String(rel?.fromEntity?.entityId ?? "") === pid || String(rel?.toEntity?.entityId ?? "") === pid),
    )
    .map((rel) => String(rel.relationshipType));
}

function interestedSubjectIds({ businessGraphRuntime, partyId }) {
  const pid = String(partyId);
  const ids = new Set();
  for (const rel of safeArray(businessGraphRuntime?.getRelationships?.())) {
    if (String(rel?.status ?? "active") !== "active" || String(rel?.relationshipType) !== "INTERESTED_IN") continue;
    if (String(rel?.fromEntity?.entityType) === ENTITY_TYPES.PARTY && String(rel?.fromEntity?.entityId) === pid) {
      ids.add(String(rel?.toEntity?.entityId));
    }
    if (String(rel?.toEntity?.entityType) === ENTITY_TYPES.PARTY && String(rel?.toEntity?.entityId) === pid) {
      ids.add(String(rel?.fromEntity?.entityId));
    }
  }
  return [...ids].filter(Boolean);
}

function requestEvidence({ requestRuntime, partyId, subjectId }) {
  const pid = String(partyId);
  return safeArray(requestRuntime?.getRequests?.()).filter((request) => {
    if (String(request?.requester ?? "") !== pid) return false;
    if (!subjectId) return true;
    return safeArray(request?.subjectRefs).some(
      (ref) => String(ref?.entityType) === ENTITY_TYPES.SUBJECT && String(ref?.entityId) === String(subjectId),
    );
  });
}

function interactionEvidence({ interactionRuntime, partyId, subjectId }) {
  const pid = String(partyId);
  return safeArray(interactionRuntime?.getInteractions?.()).filter((interaction) => {
    const partyMatch = safeArray(interaction?.participants).some((entry) => String(entry?.partyId) === pid) ||
      safeArray(interaction?.relatedObjects).some(
        (ref) => String(ref?.entityType) === ENTITY_TYPES.PARTY && String(ref?.entityId) === pid,
      );
    if (!partyMatch) return false;
    if (!subjectId) return true;
    return safeArray(interaction?.relatedObjects).some(
      (ref) => String(ref?.entityType) === ENTITY_TYPES.SUBJECT && String(ref?.entityId) === String(subjectId),
    );
  });
}

function includeReason({ audience, relationshipTypes, subjectIds, subject, requests, interactions }) {
  const type = String(audience?.type ?? "all_marketable_contacts");
  if (type === "subject_interest") {
    return subject
      ? `Interested in ${String(subject.displayName)}`
      : "Interested in selected property";
  }
  if (type === "relationship_types") {
    const allowed = new Set(safeArray(audience.relationshipTypes).map(String));
    const matched = relationshipTypes.find((type) => allowed.has(type));
    return matched ? `${matched.replace(/_/g, " ").toLowerCase()} relationship` : null;
  }
  if (subjectIds.length > 0) return "Canonical property interest recorded";
  if (requests.length > 0) return "Prior request history";
  if (interactions.length > 0) return "Prior interaction history";
  if (relationshipTypes.length > 0) return `${relationshipTypes[0].replace(/_/g, " ").toLowerCase()} relationship`;
  return "Contactable business relationship";
}

function audienceMatches({ audience, subjectId, relationshipTypes, subjectIds, requests, interactions }) {
  const type = String(audience?.type ?? "all_marketable_contacts");
  if (type === "subject_interest") return Boolean(subjectId) && subjectIds.includes(String(subjectId));
  if (type === "relationship_types") {
    const allowed = new Set(safeArray(audience.relationshipTypes).map(String));
    return relationshipTypes.some((type) => allowed.has(type));
  }
  if (type === "prior_engagement") return requests.length > 0 || interactions.length > 0;
  return relationshipTypes.some((type) => RELATIONSHIP_MARKETING_RELATIONSHIP_TYPES.has(String(type))) || subjectIds.length > 0;
}

export function buildCampaignAudiencePreview({
  stack,
  audience,
  subjectId = null,
  channel = "email",
} = {}) {
  const businessGraphRuntime = stack?.businessGraphRuntime;
  const businessSubjectRuntime = stack?.businessSubjectRuntime;
  const requestRuntime = stack?.requestRuntime;
  const interactionRuntime = stack?.interactionRuntime;
  const preferenceRuntime = stack?.communicationPreferenceRuntime;
  const subject = subjectId ? businessSubjectRuntime?.getSubject?.(String(subjectId)) : null;
  const included = [];
  const excluded = [];
  const seen = new Set();

  for (const party of safeArray(businessGraphRuntime?.getParties?.())) {
    const partyId = String(party?.id ?? "");
    if (!partyId || seen.has(partyId) || String(party?.status ?? "active") !== "active") continue;
    seen.add(partyId);
    const email = partyEmail(party);
    const relationshipTypes = relationshipTypesForParty({ businessGraphRuntime, partyId });
    const subjectIds = interestedSubjectIds({ businessGraphRuntime, partyId });
    const requests = requestEvidence({ requestRuntime, partyId, subjectId });
    const interactions = interactionEvidence({ interactionRuntime, partyId, subjectId });
    const matched = audienceMatches({ audience, subjectId, relationshipTypes, subjectIds, requests, interactions });
    if (!matched) continue;

    const permission = checkCommunicationPermitted({
      preferenceRuntime,
      partyId,
      channel,
      scope: "marketing",
    });
    if (!email || !permission.permitted) {
      excluded.push({
        partyId,
        displayName: String(party.displayName ?? partyId),
        reason: !email ? "No email address available" : permission.reason,
      });
      continue;
    }

    included.push({
      partyId,
      displayName: String(party.displayName ?? partyId),
      email,
      reasons: [includeReason({ audience, relationshipTypes, subjectIds, subject, requests, interactions })].filter(Boolean),
      evidence: {
        relationshipTypes,
        subjectIds,
        requestIds: requests.map((request) => String(request.id)),
        interactionIds: interactions.map((interaction) => String(interaction.id)),
        eligibilityBasis: String(audience?.type ?? "all_marketable_contacts") === "all_marketable_contacts"
          ? "relationship_marketing_evidence"
          : String(audience?.type ?? "all_marketable_contacts"),
      },
    });
  }

  return deepFreeze({
    subject: subject ? { id: String(subject.id), displayName: String(subject.displayName) } : null,
    included: deepFreeze(included),
    excluded: deepFreeze(excluded),
    includedCount: included.length,
    excludedCount: excluded.length,
  });
}
