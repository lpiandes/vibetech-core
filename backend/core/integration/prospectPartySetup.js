import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createCommunicationPreference } from "../communications/preferences/CommunicationPreference.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

export function recordPartyEmailOptIn({ stack, partyId, workspaceId, nowISO, source = "prospect_inquiry" }) {
  recordPartyEmailPreference({ stack, partyId, workspaceId, nowISO, status: "opt_in", source });
}

export function recordPartyEmailPreference({ stack, partyId, workspaceId, nowISO, status, source }) {
  const channel = "email";
  const preferenceStatus = String(status ?? "opt_in");
  const existing = stack.communicationPreferenceRuntime
    .getPreferencesForParty(partyId)
    .find((p) => p.channel === channel);
  if (existing && String(existing.status) === preferenceStatus) return;

  stack.communicationPreferenceRuntime.applyEvent({
    id: `evt_pref_${preferenceStatus}_${partyId}_${String(nowISO).replace(/[^a-zA-Z0-9]/g, "_")}`,
    timestampISO: nowISO,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "operating_loop",
    payload: {
      preference: createCommunicationPreference({
        id: existing?.id ?? `pref_${partyId}_email`,
        partyId,
        workspaceId: String(workspaceId),
        channel,
        scope: "all",
        status: preferenceStatus,
        source: String(source ?? "operating_loop"),
        recordedAt: nowISO,
      }),
    },
  });
}

export function ensureProspectRelationship({ stack, partyId, nowISO }) {
  const relId = `rel_PROSPECT_${partyId}`;
  if (stack.businessGraphRuntime.getRelationship(relId)) return;

  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_prospect_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "prospect_operating_loop",
    payload: {
      relationship: {
        id: relId,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: { entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" },
        relationshipType: "PROSPECT",
        status: "active",
        effectiveFrom: nowISO,
        effectiveTo: null,
        metadata: {},
        createdAt: nowISO,
        updatedAt: nowISO,
      },
    },
  });
}

export function stablePartyIdFromEmail(email) {
  const normalized = String(email ?? "").toLowerCase().trim();
  if (!normalized) return null;
  return `party_${normalized.replace(/[@.]/g, "_")}`;
}
