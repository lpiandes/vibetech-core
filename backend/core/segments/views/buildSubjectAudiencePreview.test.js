import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../../business-graph/BusinessGraphEventTypes.js";
import { BusinessSubjectRuntime } from "../../business-subject/BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../../business-subject/BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "../../business-subject/BusinessSubject.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../../request/RequestEventTypes.js";
import { createRequest } from "../../request/Request.js";
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import { createInteraction } from "../../interactions/Interaction.js";
import { INTERACTION_EVENT_TYPES } from "../../interactions/InteractionEventTypes.js";
import { ENTITY_TYPES, createEntityRef } from "../../references/EntityRef.js";
import { buildSubjectInterestSegmentCriteria } from "../buildSubjectInterestSegmentCriteria.js";
import { projectSegmentMembership } from "../SegmentProjectionEngine.js";
import { buildSubjectAudiencePreview } from "./buildSubjectAudiencePreview.js";
import { AUTOMATION_CONDITION_OPERATORS } from "../../automations/AutomationCondition.js";

const NOW = "2026-07-07T20:00:00.000Z";

function seedSubject(subjects, { id, displayName }) {
  subjects.applyEvent({
    id: `evt_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: createBusinessSubject({
        id,
        workspaceId: "ws_test",
        subjectType: "listing",
        displayName,
        keyAttributes: { address: displayName },
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

function seedParty(graph, { id, displayName, email }) {
  graph.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id,
        partyType: "PERSON",
        displayName,
        status: "active",
        contactMethods: email ? [email] : [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function seedInterestedIn(graph, { partyId, subjectId, effectiveFrom = NOW }) {
  graph.applyEvent({
    id: `evt_rel_${partyId}_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: `rel_${partyId}_${subjectId}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        relationshipType: "INTERESTED_IN",
        status: "active",
        effectiveFrom,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

test("buildSubjectInterestSegmentCriteria returns subjectIds IN criteria", () => {
  const criteria = buildSubjectInterestSegmentCriteria("subj_a");
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].fieldPath, "subjectIds");
  assert.equal(criteria[0].operator, AUTOMATION_CONDITION_OPERATORS.IN);
  assert.deepEqual(criteria[0].value, ["subj_a"]);
});

test("buildSubjectAudiencePreview returns null for unknown subject", () => {
  const preview = buildSubjectAudiencePreview({
    subjectId: "subj_missing",
    businessSubjectRuntime: new BusinessSubjectRuntime(),
    businessGraphRuntime: new BusinessGraphRuntime(),
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    interactionRuntime: new InteractionRuntime(),
    nowISO: NOW,
  });
  assert.equal(preview, null);
});

test("buildSubjectAudiencePreview member IDs match SegmentProjectionEngine", () => {
  const graph = new BusinessGraphRuntime();
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();

  seedSubject(subjects, { id: "subj_harbor", displayName: "742 Harbor Lane" });
  seedParty(graph, { id: "party_a", displayName: "Jane Smith", email: "jane@example.com" });
  seedParty(graph, { id: "party_b", displayName: "John Doe", email: "john@example.com" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_harbor" });
  seedInterestedIn(graph, { partyId: "party_b", subjectId: "subj_harbor" });

  const criteria = buildSubjectInterestSegmentCriteria("subj_harbor");
  const projection = projectSegmentMembership({
    segmentDefinition: { id: "preview", targetEntityType: "Party", criteria },
    businessGraphRuntime: graph,
    requestRuntime: requests,
    interactionRuntime: interactions,
    businessSubjectRuntime: subjects,
  });

  const preview = buildSubjectAudiencePreview({
    subjectId: "subj_harbor",
    businessSubjectRuntime: subjects,
    businessGraphRuntime: graph,
    requestRuntime: requests,
    interactionRuntime: interactions,
    presentation: {
      interactionOutcomes: [{ id: "follow_up_required", displayName: "Follow-Up Required" }],
    },
    nowISO: NOW,
  });

  assert.equal(preview.audience.totalCount, 2);
  const previewIds = preview.audience.members.map((m) => m.partyId).sort();
  const segmentIds = projection.members.map((m) => m.entityId).sort();
  assert.deepEqual(previewIds, segmentIds);
});

test("buildSubjectAudiencePreview enriches subject-scoped request source and outcome", () => {
  const graph = new BusinessGraphRuntime();
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();

  seedSubject(subjects, { id: "subj_1", displayName: "Unit 1" });
  seedParty(graph, { id: "party_1", displayName: "Alex", email: "alex@example.com" });
  seedInterestedIn(graph, { partyId: "party_1", subjectId: "subj_1" });

  requests.applyEvent({
    id: "evt_req_1",
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: createRequest({
        id: "req_1",
        title: "Inquiry",
        description: "Interested",
        requestType: "PROSPECT_INQUIRY",
        status: "received",
        priority: "medium",
        channel: "website",
        source: "vibetech_app",
        requester: "party_1",
        receivedAt: NOW,
        inboundAttribution: { sourceLabel: "website", channel: "website" },
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_1" })],
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });

  interactions.applyEvent({
    id: "evt_int_1",
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: createInteraction({
        id: "int_1",
        interactionType: "message",
        direction: "inbound",
        channel: "website",
        occurredAt: NOW,
        participants: [{ partyId: "party_1", participantType: "primary" }],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_1" }),
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: "req_1" }),
        ],
        status: "active",
        summary: "Prospect inquiry",
        outcome: "follow_up_required",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });

  const preview = buildSubjectAudiencePreview({
    subjectId: "subj_1",
    businessSubjectRuntime: subjects,
    businessGraphRuntime: graph,
    requestRuntime: requests,
    interactionRuntime: interactions,
    presentation: {
      interactionOutcomes: [{ id: "follow_up_required", displayName: "Follow-Up Required" }],
    },
    nowISO: NOW,
  });

  const member = preview.audience.members[0];
  assert.equal(member.displayName, "Alex");
  assert.equal(member.email, "alex@example.com");
  assert.equal(member.sourceLabel, "website");
  assert.equal(member.latestOutcome, "follow_up_required");
  assert.equal(member.latestOutcomeLabel, "Follow-Up Required");
  assert.equal(member.latestRequestId, "req_1");
  assert.ok(member.evidence.some((e) => e.type === "INTERESTED_IN"));
  assert.ok(member.evidence.some((e) => e.type === "REQUEST"));
});
