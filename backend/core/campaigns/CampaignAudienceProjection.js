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

/** CRM / People kinds that are valid newsletter recipients (not staff/vendors). */
const MARKETABLE_CONTACT_KINDS = new Set([
  "lead",
  "client",
  "family",
  "other",
  "prospect",
  "buyer",
  "seller",
  "past_client",
]);

const NON_MARKETABLE_CONTACT_KINDS = new Set([
  "employee",
  "vendor",
  "contractor",
]);

function partyEmail(party) {
  for (const method of safeArray(party?.contactMethods).map(String)) {
    const email = extractEmail(method);
    if (email) return email;
  }
  return extractEmail(party?.metadata?.email);
}

function extractEmail(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.includes("@") && !raw.includes(":")) return raw.toLowerCase();
  const match = raw.match(/email:([^\s]+)/i);
  return match?.[1]?.toLowerCase() ?? (raw.includes("@") ? raw.toLowerCase() : null);
}

function isMarketableKind(kind) {
  const key = String(kind ?? "").trim().toLowerCase();
  if (!key) return false;
  if (NON_MARKETABLE_CONTACT_KINDS.has(key)) return false;
  return MARKETABLE_CONTACT_KINDS.has(key);
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

function includeReason({ audience, relationshipTypes, subjectIds, subject, requests, interactions, marketableKind }) {
  const type = String(audience?.type ?? "all_marketable_contacts");
  if (type === "subject_interest") {
    return subject
      ? `Interested in ${String(subject.displayName)}`
      : "Interested in selected property";
  }
  if (type === "relationship_types") {
    const allowed = new Set(safeArray(audience.relationshipTypes).map(String));
    const matched = relationshipTypes.find((relType) => allowed.has(relType));
    return matched ? `${matched.replace(/_/g, " ").toLowerCase()} relationship` : null;
  }
  if (subjectIds.length > 0) return "Canonical property interest recorded";
  if (requests.length > 0) return "Prior request history";
  if (interactions.length > 0) return "Prior interaction history";
  if (relationshipTypes.length > 0) return `${relationshipTypes[0].replace(/_/g, " ").toLowerCase()} relationship`;
  if (marketableKind) return `People contact (${marketableKind})`;
  return "Contactable business relationship";
}

function audienceMatches({
  audience,
  subjectId,
  relationshipTypes,
  subjectIds,
  requests,
  interactions,
  marketableKind = null,
}) {
  const type = String(audience?.type ?? "all_marketable_contacts");
  if (type === "subject_interest") return Boolean(subjectId) && subjectIds.includes(String(subjectId));
  if (type === "relationship_types") {
    const allowed = new Set(safeArray(audience.relationshipTypes).map(String));
    return relationshipTypes.some((relType) => allowed.has(relType));
  }
  if (type === "prior_engagement") return requests.length > 0 || interactions.length > 0;
  // all_marketable_contacts: graph marketing evidence OR People CRM marketable kind
  return relationshipTypes.some((relType) => RELATIONSHIP_MARKETING_RELATIONSHIP_TYPES.has(String(relType)))
    || subjectIds.length > 0
    || isMarketableKind(marketableKind);
}

function normalizeCrmContacts(crmContacts = []) {
  const out = [];
  for (const entry of safeArray(crmContacts)) {
    const id = String(entry?.id ?? entry?.partyId ?? "").trim();
    const email = extractEmail(entry?.email) ?? extractEmail(safeArray(entry?.contactMethods)[0]);
    const kind = String(entry?.kind ?? entry?.metadata?.kind ?? "lead").toLowerCase();
    if (!id || !email || !isMarketableKind(kind)) continue;
    out.push({
      id,
      displayName: String(entry?.name ?? entry?.displayName ?? id),
      email,
      kind,
    });
  }
  return out;
}

/**
 * Build who can receive a campaign.
 * @param {object} [options.crmContacts] People/CRM roster — leads with email are eligible
 *   without requiring a separate graph marketing relationship first.
 */
export function buildCampaignAudiencePreview({
  stack,
  audience,
  subjectId = null,
  channel = "email",
  crmContacts = [],
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
  const crmById = new Map(normalizeCrmContacts(crmContacts).map((c) => [c.id, c]));

  const parties = safeArray(businessGraphRuntime?.getParties?.()).map((party) => ({ party, source: "graph" }));
  for (const crm of crmById.values()) {
    if (parties.some((entry) => String(entry.party?.id) === crm.id)) continue;
    parties.push({
      source: "crm",
      party: {
        id: crm.id,
        displayName: crm.displayName,
        status: "active",
        contactMethods: [`email:${crm.email}`],
        metadata: { kind: crm.kind },
      },
    });
  }

  for (const { party } of parties) {
    const partyId = String(party?.id ?? "");
    if (!partyId || seen.has(partyId) || String(party?.status ?? "active") !== "active") continue;
    seen.add(partyId);
    const crm = crmById.get(partyId);
    const email = partyEmail(party) ?? crm?.email ?? null;
    const marketableKind = crm?.kind ?? party?.metadata?.kind ?? null;
    const relationshipTypes = relationshipTypesForParty({ businessGraphRuntime, partyId });
    const subjectIds = interestedSubjectIds({ businessGraphRuntime, partyId });
    const requests = requestEvidence({ requestRuntime, partyId, subjectId });
    const interactions = interactionEvidence({ interactionRuntime, partyId, subjectId });
    const matched = audienceMatches({
      audience,
      subjectId,
      relationshipTypes,
      subjectIds,
      requests,
      interactions,
      marketableKind,
    });
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

    const fromPeopleOnly = isMarketableKind(marketableKind)
      && !relationshipTypes.some((t) => RELATIONSHIP_MARKETING_RELATIONSHIP_TYPES.has(t))
      && subjectIds.length === 0;

    included.push({
      partyId,
      displayName: String(party.displayName ?? partyId),
      email,
      reasons: [includeReason({
        audience,
        relationshipTypes,
        subjectIds,
        subject,
        requests,
        interactions,
        marketableKind,
      })].filter(Boolean),
      evidence: {
        relationshipTypes,
        subjectIds,
        requestIds: requests.map((request) => String(request.id)),
        interactionIds: interactions.map((interaction) => String(interaction.id)),
        eligibilityBasis: String(audience?.type ?? "all_marketable_contacts") === "all_marketable_contacts"
          ? (fromPeopleOnly ? "crm_people_contact" : "relationship_marketing_evidence")
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
