import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { TEAM_EVENT_TYPES } from "../team/TeamEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

import { buildRelationshipFollowUpProjection } from "./RelationshipFollowUpProjection.js";
import { buildRelationshipFollowUpEvidence } from "./RelationshipFollowUpEvidence.js";
import { RelationshipFollowUpWorkConversionService } from "./RelationshipFollowUpWorkConversionService.js";
import { RelationshipFollowUpResolutionService } from "./RelationshipFollowUpResolutionService.js";

const NOW = "2026-07-08T00:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";
const RESOLVED_OLD = "2026-06-20T00:00:00.000Z";

function addBuyerCandidateState(stack, partyId = "party_s14_buyer") {
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
        contactMethods: ["buyer@example.com"],
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
        metadata: { qualification: { decisionTimeline: "immediate", intent: "buy" } },
        inboundAttribution: null,
        subjectRefs: [],
      },
    },
  });
}

function addAssignableTeamMember(stack) {
  stack.teamRuntime.applyEvent({
    id: "evt_team_member_s14",
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

function projection(stack, nowISO = NOW) {
  return buildRelationshipFollowUpProjection({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    relationshipFollowUpRules: stack.installationResult.relationshipFollowUpRules,
    relationshipTypes: stack.installationResult.relationshipTypes,
    nowISO,
  });
}

function createFollowUpWork(stack, nowISO = NOW) {
  const candidate = projection(stack, nowISO).candidates[0];
  assert.ok(candidate, "expected relationship follow-up candidate");
  const result = new RelationshipFollowUpWorkConversionService().execute({
    stack,
    installationResult: stack.installationResult,
    candidateId: candidate.candidateId,
    nowISO,
  });
  assert.equal(result.ok, true);
  return result.workItem;
}

function latestBuyerEvidence(stack, nowISO = NOW) {
  const party = stack.businessGraphRuntime.getParty("party_s14_buyer");
  const relationship = stack.businessGraphRuntime.getRelationships().find((rel) => String(rel.relationshipType) === "BUYER");
  const rule = stack.installationResult.relationshipFollowUpRules.find((entry) => entry.id === "buyer_immediate_timeline_stale");
  return buildRelationshipFollowUpEvidence({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    relationshipTypes: stack.installationResult.relationshipTypes,
    party,
    relationship,
    rule,
    nowISO,
  });
}

test("RelationshipFollowUpResolutionService records memory then completes work idempotently", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s14_resolve" });
  addAssignableTeamMember(stack);
  addBuyerCandidateState(stack);
  const work = createFollowUpWork(stack);

  const result = new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "reached_still_interested",
    note: "Spoke with buyer. Still interested.",
    actorId: "tm_followup",
    nowISO: NOW,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshotKinds.sort(), [RUNTIME_SNAPSHOT_KINDS.INTERACTION, RUNTIME_SNAPSHOT_KINDS.WORK].sort());
  assert.equal(stack.interactionRuntime.getInteractions().length, 1);
  const interaction = stack.interactionRuntime.getInteractions()[0];
  assert.equal(interaction.outcome, "reached_still_interested");
  assert.equal(interaction.ownerId, "tm_followup");
  assert.equal(interaction.notes[0].text, "Spoke with buyer. Still interested.");
  assert.ok(interaction.relatedObjects.some((ref) => String(ref.entityType) === ENTITY_TYPES.PARTY));
  assert.ok(interaction.relatedObjects.some((ref) => String(ref.entityType) === ENTITY_TYPES.WORK && String(ref.entityId) === work.id));
  assert.equal(stack.workRuntime.getWorkItem(work.id).status, "completed");
  assert.equal(stack.automationRuntime.getRuns().length, 0);
  assert.equal(stack.communicationRuntime.getMessages().length, 0);

  const retry = new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "reached_still_interested",
    note: "Spoke with buyer. Still interested.",
    actorId: "tm_followup",
    nowISO: NOW,
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.idempotent, true);
  assert.equal(stack.interactionRuntime.getInteractions().length, 1);

  const conflict = new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "not_interested",
    actorId: "tm_followup",
    nowISO: NOW,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "conflicting_resolution");
});

test("relationship follow-up outcomes validate and enforce next follow-up date", () => {
  const outcomes = ["reached_still_interested", "no_response", "not_interested", "qualification_updated", "showing_requested", "follow_up_later"];

  for (const outcomeId of outcomes) {
    const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: `ws_s14_outcome_${outcomeId}` });
    addBuyerCandidateState(stack);
    const work = createFollowUpWork(stack, RESOLVED_OLD);
    const result = new RelationshipFollowUpResolutionService().execute({
      stack,
      installationResult: stack.installationResult,
      workId: work.id,
      outcomeId,
      nextFollowUpAt: outcomeId === "follow_up_later" ? "2026-07-20T00:00:00.000Z" : undefined,
      actorId: "tm_followup",
      nowISO: RESOLVED_OLD,
    });
    assert.equal(result.ok, true, outcomeId);
  }

  const blockedStack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s14_follow_later_required" });
  addBuyerCandidateState(blockedStack);
  const work = createFollowUpWork(blockedStack);
  const missingDate = new RelationshipFollowUpResolutionService().execute({
    stack: blockedStack,
    installationResult: blockedStack.installationResult,
    workId: work.id,
    outcomeId: "follow_up_later",
    actorId: "tm_followup",
    nowISO: NOW,
  });
  assert.equal(missingDate.ok, false);
  assert.equal(missingDate.reason, "invalid_outcome");
});

test("no_response is not meaningful customer activity but completed work still provides recurrence", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s14_no_response" });
  addBuyerCandidateState(stack);
  const work = createFollowUpWork(stack, RESOLVED_OLD);

  new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "no_response",
    actorId: "tm_followup",
    nowISO: RESOLVED_OLD,
  });

  assert.equal(latestBuyerEvidence(stack, NOW).latestMeaningfulActivityAt, RESOLVED_OLD);
  assert.equal(
    stack.interactionRuntime.getInteractions()[0].metadata.relationshipFollowUp.activitySemantics.meaningfulCustomerActivity,
    false,
  );
  const reappeared = projection(stack, NOW).candidates.find((candidate) => candidate.partyId === "party_s14_buyer");
  assert.ok(reappeared, "candidate should reappear after completed-work recurrence expires");
});

test("follow_up_later suppresses candidates until the committed date without creating future work", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s14_follow_later" });
  addBuyerCandidateState(stack);
  const work = createFollowUpWork(stack, RESOLVED_OLD);
  const beforeCount = stack.workRuntime.getWorkItems().length;

  new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "follow_up_later",
    nextFollowUpAt: "2026-07-20T00:00:00.000Z",
    actorId: "tm_followup",
    nowISO: RESOLVED_OLD,
  });

  assert.equal(stack.workRuntime.getWorkItems().length, beforeCount);
  assert.equal(projection(stack, "2026-07-08T00:00:00.000Z").candidates.length, 0);
  assert.equal(projection(stack, "2026-07-21T00:00:00.000Z").candidates.length, 1);
});

test("qualification_updated safely patches existing request metadata and survives restart", async () => {
  const workspaceId = "ws_s14_restart";
  const persistence = new InMemoryWorkspacePersistence();
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId });
  addBuyerCandidateState(stack);
  const work = createFollowUpWork(stack);

  const result = new RelationshipFollowUpResolutionService().execute({
    stack,
    installationResult: stack.installationResult,
    workId: work.id,
    outcomeId: "qualification_updated",
    qualificationUpdates: { decisionTimeline: "0_3_months", preferredLocation: "Downtown" },
    actorId: "tm_followup",
    nowISO: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.qualificationPatch.applied, true);
  assert.ok(result.snapshotKinds.includes(RUNTIME_SNAPSHOT_KINDS.REQUEST));
  const request = stack.requestRuntime.getRequest("req_profile_party_s14_buyer");
  assert.equal(request.metadata.qualification.intent, "buy");
  assert.equal(request.metadata.qualification.decisionTimeline, "0_3_months");
  assert.equal(request.metadata.qualification.preferredLocation, "Downtown");

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform: null,
    kinds: result.snapshotKinds,
    persistence,
  });
  const snapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  const rehydrated = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId, runtimeSnapshots: snapshots });
  assert.equal(rehydrated.workRuntime.getWorkItem(work.id).status, "completed");
  assert.equal(rehydrated.interactionRuntime.getInteractions()[0].outcome, "qualification_updated");
  assert.equal(rehydrated.requestRuntime.getRequest("req_profile_party_s14_buyer").metadata.qualification.preferredLocation, "Downtown");
});
