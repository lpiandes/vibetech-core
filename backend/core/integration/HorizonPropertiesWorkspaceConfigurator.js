import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "../business-subject/BusinessSubject.js";
import {
  HORIZON_DEMO_SUBJECT_EXTERNAL_ID,
} from "./FirstClientOperatingLoopRunner.js";

/**
 * Legitimate Horizon starting-state configuration only.
 * No inbound outcomes, requests, interactions, or final work state.
 */
export function configureHorizonPropertiesWorkspace({ stack, nowISO, includeSecondaryParties = true }) {
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const { businessGraphRuntime, businessSubjectRuntime, workspaceId } = stack;

  if (includeSecondaryParties) {
    seedPartyWithRelationship({
      businessGraphRuntime,
      partyId: "party_resident_horizon",
      displayName: "Jordan Kim",
      relationshipType: "RESIDENT",
      nowISO: effectiveNowISO,
    });
    seedPartyWithRelationship({
      businessGraphRuntime,
      partyId: "party_owner_horizon",
      displayName: "Harbor View Holdings",
      relationshipType: "OWNER",
      nowISO: effectiveNowISO,
    });
    seedPartyWithRelationship({
      businessGraphRuntime,
      partyId: "party_vendor_horizon",
      displayName: "QuickFix Plumbing",
      relationshipType: "VENDOR",
      nowISO: effectiveNowISO,
    });
  }

  const subjectIds = [];
  const catalog = [
    {
      id: "subj_horizon_unit_2b",
      displayName: "Unit 2B — Harbor View",
      keyAttributes: { unitNumber: "2B", bedrooms: 2 },
      externalReferences: [HORIZON_DEMO_SUBJECT_EXTERNAL_ID],
    },
    {
      id: "subj_horizon_unit_4a",
      displayName: "Unit 4A — Harbor View",
      keyAttributes: { unitNumber: "4A", bedrooms: 1 },
      externalReferences: ["horizon_unit_4a"],
    },
  ];

  for (const entry of catalog) {
    if (businessSubjectRuntime.getSubject(entry.id)) {
      subjectIds.push(entry.id);
      continue;
    }
    const subject = createBusinessSubject({
      id: entry.id,
      workspaceId: String(workspaceId ?? "ws_horizon_properties"),
      subjectType: "unit",
      displayName: entry.displayName,
      keyAttributes: entry.keyAttributes,
      externalReferences: entry.externalReferences,
      createdAt: effectiveNowISO,
      updatedAt: effectiveNowISO,
    });
    businessSubjectRuntime.applyEvent({
      id: `evt_catalog_subject_${entry.id}`,
      timestampISO: effectiveNowISO,
      type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
      source: "horizon_workspace_configurator",
      payload: { subject },
    });
    subjectIds.push(entry.id);
  }

  return {
    configuredPartyIds: includeSecondaryParties
      ? ["party_resident_horizon", "party_owner_horizon", "party_vendor_horizon"]
      : [],
    subjectIds,
  };
}

function seedPartyWithRelationship({ businessGraphRuntime, partyId, displayName, relationshipType, nowISO }) {
  if (businessGraphRuntime.getParty(partyId)) return;

  businessGraphRuntime.applyEvent({
    id: `evt_party_created_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "horizon_workspace_configurator",
    payload: {
      party: {
        id: partyId,
        partyType: relationshipType === "OWNER" ? "ORGANIZATION" : "PERSON",
        displayName,
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: { relationshipContext: relationshipType },
        createdAt: nowISO,
        updatedAt: nowISO,
      },
    },
  });

  const relId = `rel_${relationshipType}_${partyId}`;
  if (!businessGraphRuntime.getRelationship(relId)) {
    businessGraphRuntime.applyEvent({
      id: `evt_rel_${relationshipType}_${partyId}`,
      timestampISO: nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
      source: "horizon_workspace_configurator",
      payload: {
        relationship: {
          id: relId,
          fromEntity: { entityType: "Party", entityId: partyId },
          toEntity: { entityType: "Organization", entityId: "org_workspace" },
          relationshipType,
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
}
