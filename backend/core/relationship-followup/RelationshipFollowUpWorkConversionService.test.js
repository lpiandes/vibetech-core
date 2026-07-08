import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { TEAM_EVENT_TYPES } from "../team/TeamEventTypes.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

import { RelationshipFollowUpWorkConversionService, relationshipFollowUpWorkIdForCandidate } from "./RelationshipFollowUpWorkConversionService.js";
import { buildRelationshipFollowUpProjection } from "./RelationshipFollowUpProjection.js";

const NOW = "2026-07-08T00:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";

function addBuyerCandidateState(stack, partyId = "party_buyer") {
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
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id: `req_import_${partyId}`,
        title: "CRM import profile",
        description: "Imported profile",
        requestType: "crm_import_profile",
        priority: "low",
        channel: "api",
        source: "crm_import",
        requester: partyId,
        receivedAt: NOW,
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
    id: "evt_team_member_s13",
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

function projection(stack) {
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
    nowISO: NOW,
  });
}

test("RelationshipFollowUpWorkConversionService creates one canonical work item through existing subscribers", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: "ws_s13_conversion" });
  addAssignableTeamMember(stack);
  addBuyerCandidateState(stack);
  const candidate = projection(stack).candidates[0];
  assert.ok(candidate);

  const result = new RelationshipFollowUpWorkConversionService().execute({
    stack,
    installationResult: stack.installationResult,
    candidateId: candidate.candidateId,
    nowISO: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(stack.workRuntime.getWorkItems().length, 1);
  const work = stack.workRuntime.getWorkItems()[0];
  assert.equal(work.id, relationshipFollowUpWorkIdForCandidate(candidate.candidateId));
  assert.equal(work.workType, "prospect_follow_up");
  assert.equal(work.source, "relationship_followup");
  assert.equal(work.metadata.relationshipFollowUp.candidateId, candidate.candidateId);

  assert.equal(stack.store.getEventsByType("WORK_CREATED").length, 1);
  assert.equal(stack.store.getEventsByType("WORK_ASSIGNED").length, 1);
  assert.equal(stack.workRuntime.getAssignments().length, 1);
  assert.equal(stack.workRuntime.getAssignments()[0].assigneeId, "tm_followup");
  assert.equal(stack.automationRuntime.getRuns().length, 0);
  assert.equal(stack.approvalRuntime.getRequests().length, 0);
  assert.equal(stack.communicationRuntime.getMessages().length, 0);
  assert.ok(stack.analyticsRuntime.getDataPoints().some((dp) => String(dp.sourceObject?.eventType) === "WORK_CREATED"));

  const retry = new RelationshipFollowUpWorkConversionService().execute({
    stack,
    installationResult: stack.installationResult,
    candidateId: candidate.candidateId,
    nowISO: NOW,
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.existing, true);
  assert.equal(stack.workRuntime.getWorkItems().length, 1);
});

test("Relationship follow-up work persists and candidate projection rederives after restart", async () => {
  const workspaceId = "ws_s13_restart";
  const persistence = new InMemoryWorkspacePersistence();
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId });
  addBuyerCandidateState(stack);
  const candidate = projection(stack).candidates[0];
  const result = new RelationshipFollowUpWorkConversionService().execute({
    stack,
    installationResult: stack.installationResult,
    candidateId: candidate.candidateId,
    nowISO: NOW,
  });
  assert.equal(result.ok, true);

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform: null,
    kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH, RUNTIME_SNAPSHOT_KINDS.REQUEST, RUNTIME_SNAPSHOT_KINDS.WORK],
    persistence,
  });

  const snapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  const rehydrated = buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId, runtimeSnapshots: snapshots });
  assert.equal(rehydrated.workRuntime.getWorkItems().length, 1);
  const rederived = projection(rehydrated).candidates[0];
  assert.equal(rederived.existingOpenWorkId, result.workItem.id);
});
