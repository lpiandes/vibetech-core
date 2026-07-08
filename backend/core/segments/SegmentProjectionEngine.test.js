import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { createInteraction } from "../interactions/Interaction.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { createSegmentDefinition } from "./SegmentDefinition.js";
import { projectSegmentMembership } from "./SegmentProjectionEngine.js";
import { AUTOMATION_CONDITION_OPERATORS } from "../automations/AutomationCondition.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("SegmentProjectionEngine: parties related to subject without outcome", () => {
  const graph = new BusinessGraphRuntime();
  graph.applyEvent({
    id: "e1",
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: "party_1",
        partyType: "PERSON",
        displayName: "Alex",
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  graph.applyEvent({
    id: "e2",
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: "rel_1",
        fromEntity: { entityType: "Party", entityId: "party_1" },
        toEntity: { entityType: "Subject", entityId: "subj_1" },
        relationshipType: "INTERESTED_IN",
        status: "active",
        effectiveFrom: NOW,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });

  const interactions = new InteractionRuntime();
  interactions.applyEvent({
    id: "ie1",
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: createInteraction({
        id: "int_1",
        interactionType: "call",
        direction: "inbound",
        channel: "phone",
        occurredAt: NOW,
        participants: [{ partyId: "party_1", participantType: "primary" }],
        relatedObjects: [],
        status: "active",
        summary: "",
        notes: [],
        outcome: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });

  const def = createSegmentDefinition({
    id: "seg_1",
    workspaceId: "ws_1",
    name: "Interested without outcome",
    targetEntityType: "Party",
    criteria: [
      { fieldPath: "subjectCount", operator: AUTOMATION_CONDITION_OPERATORS.EXISTS },
      { fieldPath: "hasIncompleteOutcome", operator: AUTOMATION_CONDITION_OPERATORS.EQUALS, value: true },
    ],
  });

  const result = projectSegmentMembership({
    segmentDefinition: def,
    businessGraphRuntime: graph,
    interactionRuntime: interactions,
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    businessSubjectRuntime: new BusinessSubjectRuntime(),
  });

  assert.equal(result.members.length, 1);
  assert.equal(result.members[0].entityId, "party_1");
});
