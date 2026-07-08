import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "./BusinessSubjectEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";

import { reconcileHistoricalSubjectInterests } from "./SubjectInterestReconciliationService.js";

const NOW = "2026-07-01T00:00:00.000Z";

function snapshotMap(stack) {
  return Object.fromEntries(
    exportRuntimeSnapshots({
      stack,
      integrationPlatform: null,
      kinds: [
        RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH,
        RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT,
        RUNTIME_SNAPSHOT_KINDS.REQUEST,
        RUNTIME_SNAPSHOT_KINDS.INTERACTION,
      ],
    }).map((snapshot) => [snapshot.kind, snapshot.state]),
  );
}

function seedParty(stack, { partyId = "party_alex_morgan", displayName = "Alex Morgan" } = {}) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test_seed",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName,
        status: "active",
        contactMethods: ["alex@example.com"],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return partyId;
}

function seedSubject(stack, {
  subjectId = "subj_123_main",
  displayName = "123 main st",
  address = "123 main st",
  workspaceId = "ws_reconcile",
} = {}) {
  stack.businessSubjectRuntime.applyEvent({
    id: `evt_subject_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test_seed",
    payload: {
      subject: {
        id: subjectId,
        workspaceId,
        subjectType: "property",
        displayName,
        status: "active",
        keyAttributes: { address },
        externalReferences: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return subjectId;
}

function seedRequest(stack, { requestId = "req_alex", partyId = "party_alex_morgan" } = {}) {
  stack.requestRuntime.applyEvent({
    id: `evt_request_${requestId}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test_seed",
    payload: {
      request: {
        id: requestId,
        title: "Prospect inquiry",
        description: "Historical prospect inquiry.",
        requestType: "prospect_inquiry",
        priority: "medium",
        channel: "manual",
        source: "historical_note",
        requester: partyId,
        receivedAt: NOW,
        dueAt: null,
        assignedWorkId: null,
        assignedTeamMemberId: null,
        qualificationStatus: null,
        attachments: [],
        metadata: {},
        inboundAttribution: null,
        subjectRefs: [],
      },
    },
  });
  return requestId;
}

function seedInteraction(stack, {
  interactionId = "int_alex",
  partyId = "party_alex_morgan",
  requestId = "req_alex",
  text = "i want 123 main st",
} = {}) {
  stack.interactionRuntime.applyEvent({
    id: `evt_interaction_${interactionId}`,
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test_seed",
    payload: {
      interaction: {
        id: interactionId,
        interactionType: "note",
        direction: "inbound",
        channel: "manual",
        occurredAt: NOW,
        participants: [{ partyId }],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
        ],
        ownerId: "user_test",
        status: "active",
        summary: "Historical note",
        notes: [],
        outcome: null,
        nextStep: null,
        followUpAt: null,
        source: "manual",
        externalReference: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  stack.interactionRuntime.applyEvent({
    id: `evt_note_${interactionId}`,
    timestampISO: NOW,
    type: INTERACTION_EVENT_TYPES.INTERACTION_NOTE_ADDED,
    source: "test_seed",
    payload: {
      note: {
        id: `note_${interactionId}`,
        interactionId,
        authorId: "user_test",
        timestampISO: NOW,
        text,
        relatedObjects: [],
        metadata: {},
      },
    },
  });
  return interactionId;
}

function seedHistoricalAlexLikeStack({
  workspaceId = "ws_reconcile",
  text = "i want 123 main st",
  subjectId = "subj_123_main",
  subjectDisplayName = "123 main st",
  subjectAddress = "123 main st",
} = {}) {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId });
  const partyId = seedParty(stack);
  const seededSubjectId = seedSubject(stack, {
    subjectId,
    displayName: subjectDisplayName,
    address: subjectAddress,
    workspaceId,
  });
  const requestId = seedRequest(stack, { partyId });
  const interactionId = seedInteraction(stack, { partyId, requestId, text });
  return { stack, partyId, subjectId: seededSubjectId, requestId, interactionId };
}

function interestedRelationships(stack) {
  return stack.businessGraphRuntime.getRelationships().filter((relationship) => relationship.relationshipType === "INTERESTED_IN");
}

function hasSubjectRef(refs, subjectId) {
  return refs.some((ref) => ref.entityType === ENTITY_TYPES.SUBJECT && ref.entityId === subjectId);
}

test("historical exact subject evidence reconciles one existing subject into graph, request, and interaction context", () => {
  const { stack, partyId, subjectId, requestId, interactionId } = seedHistoricalAlexLikeStack();

  const result = reconcileHistoricalSubjectInterests({ stack, nowISO: NOW });

  assert.equal(result.changed, true);
  assert.equal(result.reconciledCount, 1);
  assert.equal(interestedRelationships(stack).length, 1);
  assert.equal(interestedRelationships(stack)[0].fromEntity.entityId, partyId);
  assert.equal(interestedRelationships(stack)[0].toEntity.entityId, subjectId);
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 1);
  assert.equal(hasSubjectRef(stack.requestRuntime.getRequest(requestId).subjectRefs, subjectId), true);
  assert.equal(hasSubjectRef(stack.interactionRuntime.getInteraction(interactionId).relatedObjects, subjectId), true);
});

test("historical reconciliation is idempotent and creates no duplicate subject or relationship", () => {
  const { stack } = seedHistoricalAlexLikeStack();

  reconcileHistoricalSubjectInterests({ stack, nowISO: NOW });
  const second = reconcileHistoricalSubjectInterests({ stack, nowISO: NOW });

  assert.equal(second.changed, false);
  assert.equal(interestedRelationships(stack).length, 1);
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 1);
});

test("vague and ambiguous historical text does not link or create subjects", () => {
  const vague = seedHistoricalAlexLikeStack({ text: "i want a nice place downtown" });
  const vagueResult = reconcileHistoricalSubjectInterests({ stack: vague.stack, nowISO: NOW });
  assert.equal(vagueResult.changed, false);
  assert.equal(interestedRelationships(vague.stack).length, 0);
  assert.equal(vague.stack.businessSubjectRuntime.getSubjects().length, 1);

  const ambiguous = seedHistoricalAlexLikeStack({ text: "i want 123 main st" });
  seedSubject(ambiguous.stack, {
    subjectId: "subj_123_main_duplicate",
    displayName: "123 main st",
    address: "123 main st",
  });
  const ambiguousResult = reconcileHistoricalSubjectInterests({ stack: ambiguous.stack, nowISO: NOW });
  assert.equal(ambiguousResult.changed, false);
  assert.equal(interestedRelationships(ambiguous.stack).length, 0);
  assert.equal(ambiguous.stack.businessSubjectRuntime.getSubjects().length, 2);
});

test("foreign-business subjects cannot satisfy reconciliation in another business stack", () => {
  const local = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_local" });
  const foreign = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_foreign" });
  const partyId = seedParty(local);
  const requestId = seedRequest(local, { partyId });
  seedInteraction(local, { partyId, requestId, text: "i want 123 main st" });
  seedSubject(foreign, { workspaceId: "ws_foreign" });

  const result = reconcileHistoricalSubjectInterests({ stack: local, nowISO: NOW });

  assert.equal(result.changed, false);
  assert.equal(interestedRelationships(local).length, 0);
  assert.equal(local.businessSubjectRuntime.getSubjects().length, 0);
});

test("historical reconciliation survives restart and remains idempotent after rehydrate", () => {
  const { stack, subjectId, requestId, interactionId } = seedHistoricalAlexLikeStack();
  reconcileHistoricalSubjectInterests({ stack, nowISO: NOW });

  const rehydrated = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId: "ws_reconcile",
    runtimeSnapshots: snapshotMap(stack),
  });
  const afterRestart = reconcileHistoricalSubjectInterests({ stack: rehydrated, nowISO: NOW });

  assert.equal(afterRestart.changed, false);
  assert.equal(interestedRelationships(rehydrated).length, 1);
  assert.equal(rehydrated.businessSubjectRuntime.getSubjects().length, 1);
  assert.equal(hasSubjectRef(rehydrated.requestRuntime.getRequest(requestId).subjectRefs, subjectId), true);
  assert.equal(hasSubjectRef(rehydrated.interactionRuntime.getInteraction(interactionId).relatedObjects, subjectId), true);
});
