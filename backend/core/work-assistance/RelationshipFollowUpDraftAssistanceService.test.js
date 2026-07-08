import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { ensurePartySubjectRelationship } from "../business-graph/partySubjectRelationship.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { TEAM_EVENT_TYPES } from "../team/TeamEventTypes.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RelationshipFollowUpWorkConversionService } from "../relationship-followup/RelationshipFollowUpWorkConversionService.js";
import { buildRelationshipFollowUpProjection } from "../relationship-followup/RelationshipFollowUpProjection.js";
import { RelationshipFollowUpDraftAssistanceService } from "./RelationshipFollowUpDraftAssistanceService.js";

const NOW = "2026-07-08T00:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";

function addBuyerCandidateState(stack, partyId = "party_s16_buyer") {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "Buyer One",
        status: "active",
        contactMethods: ["buyer@example.com", "5551112222"],
        externalReferences: [],
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_${partyId}`,
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: `rel_BUYER_${partyId}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" }),
        relationshipType: "BUYER",
        status: "active",
        effectiveFrom: OLD,
        effectiveTo: null,
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  stack.requestRuntime.applyEvent({
    id: `evt_req_${partyId}`,
    timestampISO: OLD,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id: `req_profile_${partyId}`,
        title: "CRM import profile",
        description: "Imported profile",
        requestType: "crm_import_profile",
        priority: "low",
        channel: "api",
        source: "crm_import",
        requester: partyId,
        receivedAt: OLD,
        dueAt: null,
        assignedWorkId: null,
        assignedTeamMemberId: null,
        qualificationStatus: "imported",
        attachments: [],
        metadata: { qualification: { decisionTimeline: "immediate", intent: "buy", propertyOfInterest: "beach place" } },
        inboundAttribution: null,
        subjectRefs: [],
      },
    },
  });
  return partyId;
}

function addSubjectLink(stack, partyId) {
  stack.businessSubjectRuntime.applyEvent({
    id: "evt_subject_s16",
    timestampISO: OLD,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id: "subj_s16_harbor",
        workspaceId: "ws_s16",
        subjectType: "listing",
        displayName: "742 Harbor Lane",
        status: "active",
        keyAttributes: { address: "742 Harbor Lane" },
        externalReferences: [],
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  ensurePartySubjectRelationship({ stack, partyId, subjectId: "subj_s16_harbor", nowISO: OLD });
}

function addPreferences(stack, partyId) {
  for (const [channel, status] of [["email", "opt_out"], ["sms", "suppressed"]]) {
    stack.communicationPreferenceRuntime.applyEvent({
      id: `evt_pref_${channel}`,
      timestampISO: OLD,
      type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
      source: "test",
      payload: {
        preference: {
          id: `pref_${partyId}_${channel}`,
          partyId,
          workspaceId: "ws_s16",
          channel,
          scope: "all",
          status,
          source: "test",
          recordedAt: OLD,
        },
      },
    });
  }
}

function addMemory(stack, partyId) {
  stack.interactionRuntime.applyEvent({
    id: "evt_imported_note_s16",
    timestampISO: OLD,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: {
        id: "int_imported_note_s16",
        interactionType: "note",
        direction: "internal",
        channel: "manual",
        occurredAt: OLD,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [],
        ownerId: null,
        status: "active",
        summary: "Imported note",
        notes: ["Imported note only"],
        outcome: null,
        nextStep: null,
        followUpAt: null,
        source: "crm_import",
        externalReference: null,
        metadata: {},
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  stack.interactionRuntime.applyEvent({
    id: "evt_no_response_s16",
    timestampISO: "2026-07-01T00:00:00.000Z",
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: {
        id: "int_no_response_s16",
        interactionType: "relationship_follow_up",
        direction: "outbound",
        channel: "manual",
        occurredAt: "2026-07-01T00:00:00.000Z",
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [],
        ownerId: null,
        status: "active",
        summary: "No response",
        notes: [],
        outcome: "no_response",
        nextStep: null,
        followUpAt: null,
        source: "relationship_followup_resolution",
        externalReference: null,
        metadata: { relationshipFollowUp: { activitySemantics: { meaningfulCustomerActivity: false } } },
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    },
  });
}

function addTeamMember(stack) {
  stack.teamRuntime.applyEvent({
    id: "evt_team_member_s16",
    timestampISO: NOW,
    type: TEAM_EVENT_TYPES.TEAM_MEMBER_CREATED,
    source: "test",
    payload: {
      member: {
        id: "tm_followup",
        name: "Prospect Follow Up Specialist",
        memberType: "human",
        departmentId: stack.teamRuntime.getDepartments()[0].id,
        roleId: stack.teamRuntime.getRoles()[0].id,
        status: "available",
        availability: 80,
        capacity: 80,
        workload: { assignedWork: 0, completedWork: 0, pendingWork: 0 },
        skills: ["prospect_follow_up"],
        permissions: ["employee"],
        metrics: {},
        metadata: {},
      },
    },
  });
}

function createFollowUpWork(stack) {
  const projection = buildRelationshipFollowUpProjection({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    relationshipFollowUpRules: stack.installationResult.relationshipFollowUpRules,
    relationshipTypes: stack.installationResult.relationshipTypes,
    nowISO: NOW,
  });
  const result = new RelationshipFollowUpWorkConversionService().execute({
    stack,
    installationResult: stack.installationResult,
    candidateId: projection.candidates[0].candidateId,
    nowISO: NOW,
  });
  assert.equal(result.ok, true);
  return result.workItem;
}

function buildReadyStack() {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s16" });
  const partyId = addBuyerCandidateState(stack);
  addSubjectLink(stack, partyId);
  addPreferences(stack, partyId);
  addMemory(stack, partyId);
  addTeamMember(stack);
  const work = createFollowUpWork(stack);
  return { stack, partyId, work };
}

const knowledge = [
  { id: "doc_ready", businessId: "ws_s16", title: "Leasing response guide", status: "ready", sourceType: "TXT", categoryIds: ["PM_LEASING"] },
  { id: "doc_other_business", businessId: "ws_other", title: "Other business guide", status: "ready", sourceType: "TXT", categoryIds: ["PM_LEASING"] },
  { id: "doc_unpublished", businessId: "ws_s16", title: "Draft guide", status: "draft", sourceType: "TXT", categoryIds: ["PM_LEASING"] },
];

test("RelationshipFollowUpDraftAssistanceService prepares one safe draft with canonical context and knowledge evidence", () => {
  const { stack, work } = buildReadyStack();
  const beforeWorkCount = stack.workRuntime.getWorkItems().length;
  const result = new RelationshipFollowUpDraftAssistanceService().execute({
    stack,
    installationResult: stack.installationResult,
    businessId: "ws_s16",
    workId: work.id,
    actorId: "tm_followup",
    knowledgeDocuments: knowledge,
    nowISO: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.draft.status, "draft");
  assert.equal(result.draft.channel, "internal");
  assert.match(result.draft.body, /Buyer One/);
  assert.match(result.draft.body, /742 Harbor Lane/);
  assert.equal(result.context.property.source, "subject_linkage");
  assert.equal(result.context.rawPropertyInterest, "beach place");
  assert.equal(result.context.latestMeaningfulActivityAt, null);
  assert.equal(result.context.importedNotes.length, 1);
  assert.equal(result.context.channelGuidance.email.permitted, false);
  assert.equal(result.context.channelGuidance.sms.permitted, false);
  assert.deepEqual(result.context.knowledgeSources.map((doc) => doc.id), ["doc_ready"]);
  assert.equal(stack.workRuntime.getWorkItems().length, beforeWorkCount);
  assert.equal(stack.communicationRuntime.getMessages().length, 1);
});

test("RelationshipFollowUpDraftAssistanceService rejects ineligible Work", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s16_bad" });
  const result = new RelationshipFollowUpDraftAssistanceService().execute({
    stack,
    installationResult: stack.installationResult,
    businessId: "ws_s16_bad",
    workId: "missing",
    nowISO: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "work_not_found");
});

test("RelationshipFollowUpDraftAssistanceService retries without duplicate drafts and survives restart", async () => {
  const { stack, work } = buildReadyStack();
  const service = new RelationshipFollowUpDraftAssistanceService();
  const first = service.execute({
    stack,
    installationResult: stack.installationResult,
    businessId: "ws_s16",
    workId: work.id,
    actorId: "tm_followup",
    knowledgeDocuments: knowledge,
    nowISO: NOW,
  });
  const retry = service.execute({
    stack,
    installationResult: stack.installationResult,
    businessId: "ws_s16",
    workId: work.id,
    actorId: "tm_followup",
    knowledgeDocuments: knowledge,
    nowISO: NOW,
  });
  assert.equal(retry.idempotent, true);
  assert.equal(stack.communicationRuntime.getMessages().length, 1);

  const persistence = new InMemoryWorkspacePersistence();
  await persistAffectedRuntimes({
    workspaceId: "ws_s16",
    stack,
    integrationPlatform: null,
    kinds: first.snapshotKinds,
    persistence,
  });
  const snapshots = await loadRuntimeSnapshotsMap("ws_s16", persistence);
  const rehydrated = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s16", runtimeSnapshots: snapshots });
  assert.equal(rehydrated.communicationRuntime.getMessages().length, 1);
  assert.equal(rehydrated.communicationRuntime.getMessages()[0].id, first.messageId);
});
