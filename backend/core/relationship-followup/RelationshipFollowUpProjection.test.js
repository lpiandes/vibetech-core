import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { WorkRuntime } from "../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { CommunicationRuntime } from "../communications/CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { buildCommunicationThreadForSeed, buildCommunicationMessageForSeed } from "../communications/CommunicationBuilder.js";
import { CommunicationPreferenceRuntime } from "../communications/preferences/CommunicationPreferenceRuntime.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildRelationshipFollowUpProjection } from "./RelationshipFollowUpProjection.js";

const NOW = "2026-07-08T00:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";
const RECENT = "2026-07-07T00:00:00.000Z";

function makeStack() {
  return {
    businessGraphRuntime: new BusinessGraphRuntime(),
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    workRuntime: new WorkRuntime({ nowISO: NOW }),
    interactionRuntime: new InteractionRuntime(),
    communicationRuntime: new CommunicationRuntime({ nowISO: NOW }),
    businessSubjectRuntime: new BusinessSubjectRuntime(),
    communicationPreferenceRuntime: new CommunicationPreferenceRuntime(),
  };
}

function addParty(stack, id, { contactMethods = ["person@example.com"] } = {}) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id,
        partyType: "PERSON",
        displayName: id,
        status: "active",
        contactMethods,
        externalReferences: [],
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
}

function addRelationship(stack, partyId, relationshipType) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_${partyId}_${relationshipType}`,
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

function addRequest(stack, partyId, { id = `req_${partyId}`, type = "crm_import_profile", receivedAt = OLD, qualification = {} } = {}) {
  stack.requestRuntime.applyEvent({
    id: `evt_req_${id}`,
    timestampISO: receivedAt,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id,
        title: "Request",
        description: "Request",
        requestType: type,
        priority: "medium",
        channel: "api",
        source: "test",
        requester: partyId,
        receivedAt,
        dueAt: null,
        assignedWorkId: null,
        assignedTeamMemberId: null,
        qualificationStatus: qualification ? "imported" : null,
        attachments: [],
        metadata: { qualification },
        inboundAttribution: null,
        subjectRefs: [],
      },
    },
  });
}

function addImportedNote(stack, partyId) {
  stack.interactionRuntime.applyEvent({
    id: `evt_import_note_${partyId}`,
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "crm_import_commit",
    payload: {
      interaction: {
        id: `int_import_${partyId}`,
        interactionType: "note",
        direction: "internal",
        channel: "api",
        occurredAt: NOW,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId })],
        ownerId: null,
        status: "active",
        summary: "Imported CRM note",
        notes: [{ id: `note_${partyId}`, interactionId: `int_import_${partyId}`, authorId: "crm_import", timestampISO: NOW, text: "Old note", relatedObjects: [], metadata: {} }],
        outcome: null,
        nextStep: null,
        followUpAt: null,
        source: "crm_import",
        externalReference: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function addCommunication(stack, partyId, createdAt) {
  stack.communicationRuntime.applyEvent({
    id: `evt_thread_${partyId}`,
    timestampISO: createdAt,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: {
      thread: buildCommunicationThreadForSeed({
        nowISO: createdAt,
        overrides: { id: `thread_${partyId}`, createdAt, updatedAt: createdAt, participants: [{ id: partyId, type: "party" }], messageIds: [], relatedObjects: [] },
      }),
    },
  });
  stack.communicationRuntime.applyEvent({
    id: `evt_message_${partyId}`,
    timestampISO: createdAt,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: {
      message: buildCommunicationMessageForSeed({
        nowISO: createdAt,
        threadId: `thread_${partyId}`,
        overrides: {
          id: `msg_${partyId}`,
          sender: { id: "tm_1", type: "human" },
          recipients: [{ id: partyId, type: "party" }],
          createdAt,
        },
      }),
    },
  });
}

function addMatchingWork(stack, partyId, relationshipType, ruleId, { status = "new", completedAt = null } = {}) {
  const candidateId = `relationship-followup:${partyId}:${relationshipType}:${ruleId}`;
  stack.workRuntime.applyEvent({
    id: `evt_work_${partyId}_${status}`,
    timestampISO: completedAt ?? NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: {
        id: `work_${partyId}_${status}`,
        title: "Prospect follow-up",
        description: "Follow up",
        workType: "prospect_follow_up",
        status,
        priority: "medium",
        stageId: "stage_follow_up",
        queueId: "queue_follow_up",
        assignedTo: "unassigned",
        requestedBy: partyId,
        source: "relationship_followup",
        dueAt: null,
        createdAt: OLD,
        updatedAt: completedAt ?? NOW,
        completedAt,
        blockedReason: null,
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId })],
        requirements: [],
        metadata: { relationshipFollowUp: { candidateId, ruleId, relationshipType, reasonCode: ruleId } },
      },
    },
  });
}

function project(stack) {
  return buildRelationshipFollowUpProjection({
    ...stack,
    relationshipFollowUpRules: PROPERTY_MANAGEMENT_PACKAGE.relationshipFollowUpRules,
    relationshipTypes: PROPERTY_MANAGEMENT_PACKAGE.relationshipTypes,
    nowISO: NOW,
  });
}

function seedCandidate(stack, partyId, relationshipType, qualification = {}) {
  addParty(stack, partyId);
  addRelationship(stack, partyId, relationshipType);
  addRequest(stack, partyId, { qualification, receivedAt: NOW });
}

test("RelationshipFollowUpProjection creates the four approved McBride candidates only", () => {
  const stack = makeStack();
  seedCandidate(stack, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
  seedCandidate(stack, "seller", "SELLER_PROSPECT", { decisionTimeline: "0_3_months", intent: "sell" });
  seedCandidate(stack, "investor", "INVESTOR", { decisionTimeline: "unknown", intent: "invest", propertyOfInterest: "Harbor View" });
  seedCandidate(stack, "prospect", "PROSPECT", { decisionTimeline: "unknown" });
  seedCandidate(stack, "owner", "OWNER", { decisionTimeline: "immediate", intent: "own" });

  const candidates = project(stack).candidates;
  assert.deepEqual(candidates.map((c) => c.ruleId), [
    "buyer_immediate_timeline_stale",
    "seller_prospect_near_term_stale",
    "investor_property_interest_stale",
    "prospect_incomplete_qualification",
  ]);
});

test("crm_import_profile and imported notes are evidence, not recent meaningful activity", () => {
  const stack = makeStack();
  seedCandidate(stack, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
  addImportedNote(stack, "buyer");

  const candidate = project(stack).candidates[0];
  assert.equal(candidate.ruleId, "buyer_immediate_timeline_stale");
  assert.equal(candidate.latestMeaningfulActivityAt, null);
  assert.equal(candidate.evidence.importedNotes.length, 1);
});

test("real operational requests, interactions, and communications count as meaningful activity", () => {
  for (const [kind, applyRecent] of [
    ["request", (stack) => addRequest(stack, "buyer", { id: "req_real", type: "PROSPECT_INQUIRY", receivedAt: RECENT, qualification: {} })],
    ["interaction", (stack) => stack.interactionRuntime.applyEvent({
      id: "evt_real_interaction",
      timestampISO: RECENT,
      type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
      source: "test",
      payload: { interaction: { id: "int_real", interactionType: "call", direction: "outbound", channel: "phone", occurredAt: RECENT, participants: [{ partyId: "buyer", participantType: "primary" }], relatedObjects: [], ownerId: null, status: "active", summary: "Call", notes: [], outcome: null, nextStep: null, followUpAt: null, source: "manual", externalReference: null, metadata: {}, createdAt: RECENT, updatedAt: RECENT } },
    })],
    ["communication", (stack) => addCommunication(stack, "buyer", RECENT)],
  ]) {
    const stack = makeStack();
    seedCandidate(stack, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
    applyRecent(stack);
    assert.equal(project(stack).candidates.length, 0, `${kind} should suppress stale candidate`);
  }
});

test("open work, completed recurrence, and contactability semantics are deterministic", () => {
  const stack = makeStack();
  seedCandidate(stack, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
  addMatchingWork(stack, "buyer", "BUYER", "buyer_immediate_timeline_stale", { status: "new" });
  stack.communicationPreferenceRuntime.applyEvent({
    id: "evt_pref_email",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "test",
    payload: { preference: { id: "pref_email", partyId: "buyer", workspaceId: "ws", channel: "email", scope: "all", status: "opt_out", source: "test", recordedAt: NOW } },
  });
  stack.communicationPreferenceRuntime.applyEvent({
    id: "evt_pref_sms",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "test",
    payload: { preference: { id: "pref_sms", partyId: "buyer", workspaceId: "ws", channel: "sms", scope: "all", status: "suppressed", source: "test", recordedAt: NOW } },
  });

  const candidate = project(stack).candidates[0];
  assert.equal(candidate.existingOpenWorkId, "work_buyer_new");
  assert.equal(candidate.contactability.email.permitted, false);
  assert.equal(candidate.contactability.sms.permitted, false);

  const blocked = makeStack();
  seedCandidate(blocked, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
  addMatchingWork(blocked, "buyer", "BUYER", "buyer_immediate_timeline_stale", {
    status: "completed",
    completedAt: "2026-07-05T00:00:00.000Z",
  });
  assert.equal(project(blocked).candidates.length, 0);

  const reappeared = makeStack();
  seedCandidate(reappeared, "buyer", "BUYER", { decisionTimeline: "immediate", intent: "buy" });
  addMatchingWork(reappeared, "buyer", "BUYER", "buyer_immediate_timeline_stale", {
    status: "completed",
    completedAt: "2026-06-20T00:00:00.000Z",
  });
  assert.equal(project(reappeared).candidates[0].ruleId, "buyer_immediate_timeline_stale");
});
