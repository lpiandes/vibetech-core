import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { ensurePartySubjectRelationship } from "../business-graph/partySubjectRelationship.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { buildRelationshipOperationsIntelligence } from "./RelationshipOperationsIntelligenceProjection.js";

const BUSINESS_ID = "ws_s17";
const NOW = "2026-07-08T00:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";

function addParty(stack, { partyId, name, relationshipType = "BUYER" }) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: name,
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  stack.businessGraphRuntime.applyEvent({
    id: `evt_relationship_${partyId}_${relationshipType}`,
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: `rel_${relationshipType}_${partyId}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" }),
        relationshipType,
        status: "active",
        effectiveFrom: OLD,
        effectiveTo: null,
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
}

function addSubject(stack, { subjectId, displayName }) {
  stack.businessSubjectRuntime.applyEvent({
    id: `evt_subject_${subjectId}`,
    timestampISO: OLD,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id: subjectId,
        workspaceId: BUSINESS_ID,
        subjectType: "listing",
        displayName,
        status: "active",
        keyAttributes: { address: displayName },
        externalReferences: [],
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
}

function addFollowUpWork(stack, { workId, partyId, assignedTo = "tm_ops", status = "ready", dueAt = "2026-07-01T00:00:00.000Z" }) {
  stack.workRuntime.applyEvent({
    id: `evt_work_${workId}`,
    timestampISO: OLD,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: {
        id: workId,
        title: `Follow up ${partyId}`,
        description: "Relationship follow-up",
        workType: "prospect_follow_up",
        status,
        priority: "medium",
        stageId: "stage_intake",
        queueId: "queue_needs_review",
        assignedTo,
        requestedBy: partyId,
        source: "relationship_followup",
        dueAt,
        createdAt: OLD,
        updatedAt: OLD,
        completedAt: status === "completed" ? "2026-07-02T00:00:00.000Z" : null,
        blockedReason: null,
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId })],
        requirements: [],
        metadata: {
          relationshipFollowUp: {
            candidateId: `relationship-followup:${partyId}:BUYER:pm_buyer_reactivation`,
            ruleId: "pm_buyer_reactivation",
            relationshipType: "BUYER",
          },
        },
      },
    },
  });
}

function addOutcome(stack, { interactionId, partyId, workId, outcomeId, followUpAt = null }) {
  stack.interactionRuntime.applyEvent({
    id: `evt_interaction_${interactionId}`,
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: {
        id: interactionId,
        interactionType: "relationship_follow_up",
        direction: "outbound",
        channel: "manual",
        occurredAt: NOW,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: workId })],
        ownerId: "tm_ops",
        status: "active",
        summary: `Outcome ${outcomeId}`,
        notes: [],
        outcome: outcomeId,
        nextStep: outcomeId === "follow_up_later" ? "follow_up_later" : null,
        followUpAt,
        source: "relationship_followup_resolution",
        externalReference: null,
        metadata: {
          relationshipFollowUp: {
            workId,
            candidateId: `relationship-followup:${partyId}:BUYER:pm_buyer_reactivation`,
            relationshipType: "BUYER",
            ruleId: "pm_buyer_reactivation",
            outcomeId,
            activitySemantics: { meaningfulCustomerActivity: outcomeId !== "no_response" },
          },
        },
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function addDraft(stack, { workId, partyId }) {
  stack.communicationRuntime.applyEvent({
    id: `evt_thread_${workId}`,
    timestampISO: NOW,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: {
      thread: {
        id: `thread_${workId}`,
        subject: "Draft",
        status: "draft",
        channel: "internal",
        participants: [],
        messageIds: [],
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: workId })],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  stack.communicationRuntime.applyEvent({
    id: `evt_message_${workId}`,
    timestampISO: NOW,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: {
      message: {
        id: `msg_${workId}`,
        threadId: `thread_${workId}`,
        direction: "outbound",
        channel: "internal",
        status: "draft",
        sender: { id: "tm_ops", type: "human" },
        recipients: [{ id: partyId, type: "party" }],
        subject: "Draft",
        body: "Draft body",
        createdAt: NOW,
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: workId })],
        metadata: { workAssistanceDraft: { assistanceType: "relationship_followup", workId } },
      },
    },
  });
}

function project(stack) {
  return buildRelationshipOperationsIntelligence({
    businessId: BUSINESS_ID,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationRuntime: stack.communicationRuntime,
    teamRuntime: stack.teamRuntime,
    relationshipTypes: stack.installationResult.relationshipTypes,
    nowISO: NOW,
  });
}

test("relationship operations intelligence summarizes follow-up work, outcomes, drafts, workload, and canonical property demand", () => {
  const stack = buildPropertyManagementWorkspaceStack({ workspaceId: BUSINESS_ID, nowISO: NOW });
  addParty(stack, { partyId: "party_ada", name: "Ada Buyer" });
  addParty(stack, { partyId: "party_ben", name: "Ben Buyer" });
  addSubject(stack, { subjectId: "subj_harbor", displayName: "742 Harbor Lane" });
  ensurePartySubjectRelationship({ stack, partyId: "party_ada", subjectId: "subj_harbor", nowISO: OLD });
  ensurePartySubjectRelationship({ stack, partyId: "party_ben", subjectId: "subj_harbor", nowISO: OLD });
  addFollowUpWork(stack, { workId: "work_ada", partyId: "party_ada", assignedTo: "tm_ops" });
  addFollowUpWork(stack, { workId: "work_ben", partyId: "party_ben", assignedTo: "unassigned", dueAt: "2026-07-10T00:00:00.000Z" });
  addFollowUpWork(stack, { workId: "work_done", partyId: "party_ada", status: "completed" });
  addOutcome(stack, { interactionId: "int_ada_1", partyId: "party_ada", workId: "work_ada", outcomeId: "no_response" });
  addOutcome(stack, { interactionId: "int_ada_2", partyId: "party_ada", workId: "work_ada", outcomeId: "no_response" });
  addOutcome(stack, { interactionId: "int_ben_1", partyId: "party_ben", workId: "work_ben", outcomeId: "follow_up_later", followUpAt: "2026-07-15T00:00:00.000Z" });
  addDraft(stack, { workId: "work_ada", partyId: "party_ada" });

  const view = project(stack);

  assert.equal(view.readOnly, true);
  assert.equal(view.metrics.find((m) => m.id === "open_follow_up_work").value, 2);
  assert.equal(view.metrics.find((m) => m.id === "overdue_follow_up_work").value, 1);
  assert.equal(view.metrics.find((m) => m.id === "completed_follow_up_work").value, 1);
  assert.equal(view.metrics.find((m) => m.id === "drafts_prepared").value, 1);
  assert.equal(view.outcomeMix.find((row) => row.id === "no_response").count, 2);
  assert.equal(view.repeatedNoResponse[0].partyName, "Ada Buyer");
  assert.equal(view.propertyDemand[0].subjectName, "742 Harbor Lane");
  assert.equal(view.propertyDemand[0].interestedCount, 2);
  assert.equal(view.assigneeWorkload.some((row) => row.assigneeId === "unassigned" && row.openCount === 1), true);
  assert.equal(view.futureFollowUps[0].partyName, "Ben Buyer");
});

test("relationship operations intelligence ignores weak property strings and does not mutate runtimes", () => {
  const stack = buildPropertyManagementWorkspaceStack({ workspaceId: BUSINESS_ID, nowISO: NOW });
  addParty(stack, { partyId: "party_raw", name: "Raw Interest" });
  addFollowUpWork(stack, { workId: "work_raw", partyId: "party_raw" });

  const before = JSON.stringify({
    work: stack.workRuntime.exportState(),
    graph: stack.businessGraphRuntime.exportState(),
    subjects: stack.businessSubjectRuntime.exportState(),
    interactions: stack.interactionRuntime.exportState(),
    communications: stack.communicationRuntime.exportState(),
  });

  const view = project(stack);

  assert.equal(view.propertyDemand.length, 0);
  assert.equal(view.metrics.find((m) => m.id === "open_follow_up_work").value, 1);
  assert.equal(
    JSON.stringify({
      work: stack.workRuntime.exportState(),
      graph: stack.businessGraphRuntime.exportState(),
      subjects: stack.businessSubjectRuntime.exportState(),
      interactions: stack.interactionRuntime.exportState(),
      communications: stack.communicationRuntime.exportState(),
    }),
    before,
  );
});
