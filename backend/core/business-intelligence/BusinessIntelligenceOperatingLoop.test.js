import test from "node:test";
import assert from "node:assert/strict";

import {
  createEvidenceReference,
  assertEvidenceTenant,
  createObservationDefinition,
  createInsightDefinition,
  createRecommendationDefinition,
  BusinessIntelligenceDefinitionRegistry,
  resetDefaultBusinessIntelligenceDefinitionRegistryForTests,
  registerDefaultBusinessIntelligenceDefinitions,
  contributeBusinessIntelligenceDefinitions,
  createIntelligenceCandidate,
  IntelligenceCandidateRuntime,
  IntelligenceCandidateLifecycle,
  BusinessIntelligenceEvaluationService,
  IntelligenceToWorkConversionService,
  intelligenceWorkIdForCandidate,
  buildIntelligenceCandidateArchitectBrief,
  buildBusinessMemoryTimeline,
  compareBusinessSnapshots,
  captureEvaluationPoint,
} from "./index.js";
import { IntelligenceToArchitectChangeService } from "./conversion/IntelligenceToArchitectChangeService.js";
import { registerPropertyManagementIntelligenceDefinitions } from "../../../industries/property-management/config/propertyManagementIntelligenceDefinitions.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { ensurePartySubjectRelationship } from "../business-graph/partySubjectRelationship.js";

const NOW = "2026-07-11T12:00:00.000Z";
const OLD = "2026-06-01T00:00:00.000Z";

function workAction() {
  return {
    actionId: "create_work",
    kind: "create_work",
    label: "Create Work",
    workTemplate: { workType: "intelligence_follow_up", priority: "high" },
    requiresApproval: true,
  };
}

function seedUnassignedRequest(stack, requestId = "req_unassigned_1") {
  stack.requestRuntime.applyEvent({
    id: `evt_${requestId}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id: requestId,
        title: "Tour request",
        description: "Needs an owner",
        requestType: "prospect_inquiry",
        priority: "high",
        channel: "website",
        source: "test",
        requester: "party_x",
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
}

test("definition factories validate and deep-freeze contracts", () => {
  const observation = createObservationDefinition({
    definitionId: "obs_test",
    version: "1.0.0",
    title: "Test",
    description: "d",
    category: "workflow",
    evaluatorId: "obs_test",
  });
  assert.equal(observation.kind, "observation");
  assert.throws(() => {
    observation.title = "x";
  });
  assert.throws(() => createInsightDefinition({
    definitionId: "ins",
    version: "1",
    title: "t",
    description: "d",
    category: "c",
  }));
  assert.throws(() => createRecommendationDefinition({
    definitionId: "rec",
    version: "1",
    title: "t",
    description: "d",
    category: "c",
    sourceInsightDefinitionIds: ["ins"],
  }));
});

test("duplicate registration is rejected", () => {
  const registry = new BusinessIntelligenceDefinitionRegistry();
  const observation = {
    definitionId: "obs_dup",
    version: "1.0.0",
    title: "Dup",
    description: "d",
    category: "workflow",
    evaluatorId: "obs_dup",
  };
  registry.registerObservation(observation);
  assert.throws(() => registry.registerObservation(observation));
});

test("package contribution registers without editing central evaluator map", () => {
  const registry = resetDefaultBusinessIntelligenceDefinitionRegistryForTests();
  registerDefaultBusinessIntelligenceDefinitions({ registry, replace: true });
  assert.equal(registry.getEvaluator("obs_package_only"), null);
  contributeBusinessIntelligenceDefinitions({
    source: "package:test",
    registry,
    evaluators: { obs_package_only: () => [] },
    observations: [{
      definitionId: "obs_package_only",
      version: "1.0.0",
      title: "Package only",
      description: "d",
      category: "workflow",
      evaluatorId: "obs_package_only",
    }],
    insights: [{
      definitionId: "ins_package_only",
      version: "1.0.0",
      title: "Package insight",
      description: "d",
      category: "workflow",
      requiredObservationDefinitionIds: ["obs_package_only"],
    }],
    recommendations: [{
      definitionId: "rec_package_only",
      version: "1.0.0",
      title: "Package rec",
      description: "d",
      category: "workflow",
      sourceInsightDefinitionIds: ["ins_package_only"],
      recommendedActions: [workAction()],
    }],
  });
  assert.equal(typeof registry.getEvaluator("obs_package_only"), "function");
});

test("evidence tenant validation and insufficient evidence / no opaque score", () => {
  const evidence = [createEvidenceReference({
    objectType: "request",
    objectId: "req_1",
    businessId: "biz_a",
    observedAt: NOW,
    explanation: "Open request",
  })];
  assert.equal(assertEvidenceTenant(evidence, "biz_a"), true);
  assert.throws(() => assertEvidenceTenant(evidence, "biz_b"));
  assert.throws(() => createIntelligenceCandidate({
    businessId: "biz_a",
    definitionId: "rec_x",
    title: "t",
    summary: "s",
    explanation: "e",
    confidenceReason: "r",
    deduplicationKey: "k",
    evidence: [],
  }));
  assert.throws(() => createIntelligenceCandidate({
    businessId: "biz_a",
    definitionId: "rec_x",
    title: "t",
    summary: "s",
    explanation: "e",
    deduplicationKey: "k",
    evidence,
  }));
});

test("deterministic evaluation, dedupe, persistence, dismiss cooldown, no silent communication", async () => {
  const activated = activateWorkspace({
    workspaceId: "ws_bi_loop",
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: { companyName: "BI Co" },
    },
    nowISO: NOW,
  });
  const stack = activated.operatingStack;
  assert.ok(stack.intelligenceCandidateRuntime);
  seedUnassignedRequest(stack);

  const registry = resetDefaultBusinessIntelligenceDefinitionRegistryForTests();
  registerDefaultBusinessIntelligenceDefinitions({ registry, replace: true });
  const service = new BusinessIntelligenceEvaluationService({ registry });

  const first = await service.evaluate({
    stack,
    businessId: "ws_bi_loop",
    nowISO: NOW,
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  });
  assert.ok(first.ok);
  const openBefore = stack.intelligenceCandidateRuntime.getOpenCandidates();
  assert.ok(openBefore.length >= 1);
  const candidate = openBefore.find((c) => String(c.definitionId).includes("unassigned_request")) ?? openBefore[0];
  assert.ok(candidate.confidenceReason);
  assert.ok(candidate.evidence.length);

  await service.evaluate({
    stack,
    businessId: "ws_bi_loop",
    nowISO: NOW,
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  });
  const sameKey = stack.intelligenceCandidateRuntime.getOpenCandidates()
    .filter((c) => c.deduplicationKey === candidate.deduplicationKey);
  assert.equal(sameKey.length, 1);

  const persistence = new InMemoryWorkspacePersistence();
  await persistAffectedRuntimes({
    workspaceId: "ws_bi_loop",
    stack,
    kinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
    persistence,
  });
  const map = await loadRuntimeSnapshotsMap("ws_bi_loop", persistence);
  assert.ok(map[RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE]);

  const reloaded = activateWorkspace({
    workspaceId: "ws_bi_loop_reload",
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: { companyName: "BI Co" },
    },
    nowISO: NOW,
    runtimeSnapshots: map,
  });
  const restored = reloaded.operatingStack.intelligenceCandidateRuntime.getCandidate(candidate.id);
  assert.ok(restored);
  assert.equal(restored.deduplicationKey, candidate.deduplicationKey);

  const dismissed = new IntelligenceCandidateLifecycle().dismiss({
    stack,
    candidateId: candidate.id,
    reason: "Not relevant this week",
  });
  assert.equal(dismissed.ok, true);
  assert.equal(dismissed.silentExternalCommunication, false);

  await service.evaluate({
    stack,
    businessId: "ws_bi_loop",
    nowISO: NOW,
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  });
  assert.equal(stack.intelligenceCandidateRuntime.getCandidate(candidate.id).status, "DISMISSED");
});

test("PM buyer rule uses BusinessSubject + INTERESTED_IN via package contribution", async () => {
  const registry = resetDefaultBusinessIntelligenceDefinitionRegistryForTests();
  registerPropertyManagementIntelligenceDefinitions(registry);
  assert.ok(registry.getObservation("obs_pm_stale_immediate_buyers"));
  assert.equal(typeof registry.getEvaluator("obs_pm_stale_immediate_buyers"), "function");

  const activated = activateWorkspace({
    workspaceId: "ws_pm_bi",
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: { companyName: "PM BI" },
    },
    nowISO: NOW,
  });
  const stack = activated.operatingStack;
  const partyId = "party_buyer_1";
  const subjectId = "subject_listing_1";

  stack.businessGraphRuntime.applyEvent({
    id: "evt_party_buyer",
    timestampISO: OLD,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "Immediate Buyer",
        status: "active",
        contactMethods: ["buyer@example.com"],
        externalReferences: [],
        metadata: { timeline: "immediate" },
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  stack.businessSubjectRuntime.applyEvent({
    id: "evt_subject_listing",
    timestampISO: OLD,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id: subjectId,
        workspaceId: "ws_pm_bi",
        subjectType: "listing",
        displayName: "123 Main",
        status: "active",
        keyAttributes: {},
        externalReferences: [],
        createdAt: OLD,
        updatedAt: OLD,
      },
    },
  });
  const linked = ensurePartySubjectRelationship({
    stack,
    partyId,
    subjectId,
    nowISO: OLD,
    metadata: { timeline: "immediate" },
  });
  assert.equal(linked.ok, true);

  const service = new BusinessIntelligenceEvaluationService({ registry });
  const result = await service.evaluate({
    stack,
    businessId: "ws_pm_bi",
    nowISO: NOW,
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  });
  const buyer = result.candidates.find((c) => String(c.definitionId).includes("pm_stale_immediate"));
  assert.ok(buyer, "PM stale immediate buyer candidate expected");
  assert.ok(buyer.evidence.some((e) => e.objectType === "relationship" || e.objectType === "party"));
});

test("Work conversion is idempotent and never silent external communication", async () => {
  const activated = activateWorkspace({
    workspaceId: "ws_bi_work",
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: { companyName: "Work BI" },
    },
    nowISO: NOW,
  });
  const stack = activated.operatingStack;
  const runtime = stack.intelligenceCandidateRuntime;
  const candidate = runtime.upsertCandidate({
    businessId: "ws_bi_work",
    definitionId: "rec_unassigned_request",
    title: "Unassigned request",
    summary: "Request has no owner",
    explanation: "Open request lacks assignee",
    confidenceReason: "assignedTeamMemberId is null",
    severity: "high",
    evidence: [createEvidenceReference({
      objectType: "request",
      objectId: "req_x",
      businessId: "ws_bi_work",
      observedAt: NOW,
      explanation: "Unassigned",
    })],
    recommendedActions: [workAction()],
    relatedObjectRefs: [{ objectType: "request", objectId: "req_x" }],
    deduplicationKey: "rec_unassigned_request:request:req_x",
    status: "SURFACED",
  }, { nowISO: NOW });

  const converter = new IntelligenceToWorkConversionService();
  const first = await converter.execute({ stack, candidateId: candidate.id, nowISO: NOW });
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.silentExternalCommunication, false);
  assert.equal(first.workItem.id, intelligenceWorkIdForCandidate(candidate.id));

  const second = await converter.execute({ stack, candidateId: candidate.id, nowISO: NOW });
  assert.equal(second.ok, true);
  assert.equal(second.existing, true);
  assert.equal(second.workItem.id, first.workItem.id);
  assert.equal(runtime.getCandidate(candidate.id).status, "CONVERTED_TO_WORK");
});

test("Architect explanation uses evidence only; proposal conversion does not install", async () => {
  const candidate = createIntelligenceCandidate({
    businessId: "biz",
    definitionId: "rec_x",
    title: "Needs follow-up",
    summary: "Stale relationship",
    explanation: "No interaction in 14 days",
    confidenceReason: "Measured from interaction runtime",
    evidence: [createEvidenceReference({
      objectType: "party",
      objectId: "p1",
      businessId: "biz",
      observedAt: NOW,
      explanation: "Party is stale",
    })],
    missingEvidence: ["interaction.latest"],
    recommendedActions: [workAction()],
    deduplicationKey: "k1",
  });
  const brief = buildIntelligenceCandidateArchitectBrief({ candidate, stack: null });
  assert.equal(brief.inventedFacts, false);
  assert.ok(brief.answers.evidence.length);

  let installed = false;
  const fakeContinuous = {
    async startImprovement(input) {
      assert.equal(input.extraMetadata.neverInstallAutomatically, true);
      assert.equal(input.extraMetadata.proposeOnly, true);
      return {
        ok: true,
        session: { sessionId: "sess_1" },
        openHref: "/b/biz/architect?sessionId=sess_1",
      };
    },
    aiBuilder: {
      async install() {
        installed = true;
      },
    },
  };
  const runtime = new IntelligenceCandidateRuntime();
  runtime.upsertCandidate({ ...candidate, status: "SURFACED" }, { nowISO: NOW });
  const result = await new IntelligenceToArchitectChangeService({
    continuousBuilder: fakeContinuous,
  }).execute({
    stack: { intelligenceCandidateRuntime: runtime },
    candidateId: candidate.id,
    businessId: "biz",
    installedSpecification: { version: 1 },
    nowISO: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.installed, false);
  assert.equal(installed, false);
});

test("resolve when condition clears; snapshot diff and memory timeline", async () => {
  const activated = activateWorkspace({
    workspaceId: "ws_bi_resolve",
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: { companyName: "Resolve BI" },
    },
    nowISO: NOW,
  });
  const stack = activated.operatingStack;
  seedUnassignedRequest(stack, "req_resolve_1");

  const registry = resetDefaultBusinessIntelligenceDefinitionRegistryForTests();
  registerDefaultBusinessIntelligenceDefinitions({ registry, replace: true });
  const service = new BusinessIntelligenceEvaluationService({ registry });
  await service.evaluate({
    stack,
    businessId: "ws_bi_resolve",
    nowISO: NOW,
  });
  const beforePoint = captureEvaluationPoint({
    intelligenceCandidateRuntime: stack.intelligenceCandidateRuntime,
    workRuntime: stack.workRuntime,
    nowISO: NOW,
  });
  assert.ok(beforePoint.candidates.some((c) => ["DETECTED", "SURFACED", "IN_REVIEW"].includes(c.status)));

  // Assign the request → condition clears → reevaluation resolves.
  stack.requestRuntime.applyEvent({
    id: "evt_assign_resolve",
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
    source: "test",
    payload: {
      requestId: "req_resolve_1",
      patch: { assignedTeamMemberId: "tm_owner" },
    },
  });
  await service.evaluate({
    stack,
    businessId: "ws_bi_resolve",
    nowISO: NOW,
  });
  const openUnassigned = stack.intelligenceCandidateRuntime.getOpenCandidates()
    .filter((c) => String(c.definitionId).includes("unassigned_request")
      && String(c.deduplicationKey).includes("req_resolve_1"));
  assert.equal(openUnassigned.length, 0);
  const resolved = stack.intelligenceCandidateRuntime.getCandidates()
    .find((c) => String(c.definitionId).includes("unassigned_request")
      && String(c.deduplicationKey).includes("req_resolve_1"));
  assert.equal(resolved?.status, "RESOLVED");

  const afterPoint = captureEvaluationPoint({
    intelligenceCandidateRuntime: stack.intelligenceCandidateRuntime,
    workRuntime: stack.workRuntime,
    nowISO: NOW,
  });
  const diff = compareBusinessSnapshots({ before: beforePoint, after: afterPoint });
  assert.equal(diff.hasChanges, true);
  const memory = buildBusinessMemoryTimeline({
    intelligenceCandidateRuntime: stack.intelligenceCandidateRuntime,
  });
  assert.ok(memory.events.some((e) => e.kind.includes("intelligence")));
});

test("exportRuntimeSnapshots includes intelligence candidates", () => {
  const runtime = new IntelligenceCandidateRuntime();
  runtime.upsertCandidate({
    businessId: "biz",
    definitionId: "rec_x",
    title: "t",
    summary: "s",
    explanation: "e",
    confidenceReason: "r",
    evidence: [createEvidenceReference({
      objectType: "request",
      objectId: "r1",
      businessId: "biz",
      observedAt: NOW,
      explanation: "e",
    })],
    deduplicationKey: "k",
  }, { nowISO: NOW });
  const exported = exportRuntimeSnapshots({
    stack: { intelligenceCandidateRuntime: runtime },
    kinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
  });
  assert.equal(exported.length, 1);
  assert.equal(exported[0].kind, RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE);
});
