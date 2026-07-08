import assert from "node:assert/strict";
import { test } from "node:test";

import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { buildRequestForSeed } from "../request/RequestBuilder.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { RecordCommunicationService } from "../communications/use-cases/RecordCommunicationService.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "../approvals/ApprovalEventTypes.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { TIMELINE_ITEM_TYPES } from "../engagement/EngagementDefaults.js";
import { RequestViewAdapter } from "../request/views/RequestViewAdapter.js";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { AutomationOrchestrationService } from "../automations/AutomationOrchestrationService.js";
import { AutomationRuleEngine } from "../automations/engine/AutomationRuleEngine.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const CONVERTED_AT_ISO = "2026-07-02T00:00:00.000Z";

function frozenApprovalPlatformEvent({ eventType, approvalId, nowISO }) {
  return deepFreeze({
    eventId: `evt_${String(eventType).toLowerCase()}_${approvalId}_${nowISO}`,
    eventType: String(eventType),
    version: 1,
    occurredAt: nowISO,
    publisher: "approval_os",
    aggregateType: "approval",
    aggregateId: approvalId,
    correlationId: approvalId,
    causationId: approvalId,
    payload: deepFreeze({ approvalId: String(approvalId) }),
    metadata: deepFreeze({}),
  });
}

function seedPartyWithRelationship({ businessGraphRuntime, partyId, displayName, relationshipType, nowISO }) {
  businessGraphRuntime.applyEvent({
    id: `evt_party_created_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "pm_scenario",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
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

  businessGraphRuntime.applyEvent({
    id: `evt_rel_${relationshipType}_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "pm_scenario",
    payload: {
      relationship: {
        id: `rel_${relationshipType}_${partyId}`,
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

function convertRequest({
  stack,
  requestId,
  requestType,
  title,
  description,
  partyId,
}) {
  const { requestRuntime, workRuntime, businessGraphRuntime, osRequestPublisher, osWorkPublisher } = stack;
  const workId = `work_${requestId}`;

  requestRuntime.applyEvent({
    id: `evt_req_received_${requestId}`,
    timestampISO: NOW_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "pm_scenario",
    payload: {
      request: buildRequestForSeed({
        nowISO: NOW_ISO,
        overrides: {
          id: requestId,
          title,
          description,
          requestType,
          status: "received",
          priority: "medium",
          channel: "api",
          source: "pm-package",
          requester: partyId,
          metadata: { requiredCapabilities: [] },
        },
      }),
    },
  });

  businessGraphRuntime.applyEvent({
    id: `evt_rel_req_${requestId}_${partyId}`,
    timestampISO: NOW_ISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "pm_scenario",
    payload: {
      relationship: {
        id: `rel_req_${requestId}_${partyId}`,
        fromEntity: { entityType: "Request", entityId: requestId },
        toEntity: { entityType: "Party", entityId: partyId },
        relationshipType: "REQUESTED_BY",
        status: "active",
        effectiveFrom: NOW_ISO,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      },
    },
  });

  requestRuntime.applyEvent({
    id: `evt_req_qualified_${requestId}`,
    timestampISO: NOW_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
    source: "pm_scenario",
    payload: { requestId, qualificationStatus: "triaged" },
  });

  const requestConvertedEvent = {
    id: `evt_req_converted_${requestId}`,
    timestampISO: CONVERTED_AT_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
    source: "pm_scenario",
    payload: { requestId, assignedWorkId: null, assignedTeamMemberId: null, qualificationStatus: "triaged" },
  };
  requestRuntime.applyEvent(requestConvertedEvent);
  osRequestPublisher.publishRequestConverted({ requestRuntime, requestConvertedEvent, convertedAtISO: CONVERTED_AT_ISO });

  const createdWorkItem = workRuntime.getWorkItem(workId);
  osWorkPublisher.publishWorkCreated({ workRuntime, createdWorkItem, createdAtISO: CONVERTED_AT_ISO });

  return { workId, createdWorkItem };
}

function recordInteractionWithOutcome({
  stack,
  interactionId,
  workId,
  requestId,
  partyId,
  noteText,
  outcome,
  followUpAt = null,
}) {
  const { interactionRuntime, osInteractionPublisher } = stack;
  const recordInteractionService = new RecordInteractionService({ interactionPlatformEventPublisher: osInteractionPublisher });
  recordInteractionService.execute({
    interactionRuntime,
    interactionInput: {
      id: interactionId,
      interactionType: "call",
      direction: "outbound",
      channel: "phone",
      occurredAt: NOW_ISO,
      participants: [{ partyId, participantType: "PERSON" }],
      relatedObjects: [{ workItemId: workId }, { requestId }, { partyId }],
      ownerId: "tm_leasing",
      status: "active",
      summary: "Property management interaction",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      notes: [],
      outcome: null,
      nextStep: null,
      followUpAt: null,
      source: "pm_scenario",
      externalReference: null,
      metadata: {},
    },
    noteText,
    noteAuthorId: "tm_leasing",
    noteTimestampISO: NOW_ISO,
    outcome,
    nextStep: outcome,
    followUpAt,
    nowISO: NOW_ISO,
    metadata: {},
  });
}

test("PM Scenario A: Prospect inquiry → showing coordination work", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO, workspaceId: "ws_pm_a" });
  const partyId = "party_prospect_a";
  const requestId = "req_prospect_inquiry_a";
  const interactionId = `int_${requestId}`;
  const exactNote = "Prospect asked about 2BR availability and wants a showing this week.";

  seedPartyWithRelationship({
    businessGraphRuntime: stack.businessGraphRuntime,
    partyId,
    displayName: "Taylor Brooks",
    relationshipType: "PROSPECT",
    nowISO: NOW_ISO,
  });

  const { workId } = convertRequest({
    stack,
    requestId,
    requestType: "PROSPECT_INQUIRY",
    title: "Prospect inquiry — 2BR availability",
    description: "Inbound prospect inquiry about unit availability.",
    partyId,
  });

  const communicationService = new RecordCommunicationService();
  communicationService.execute({
    communicationRuntime: stack.communicationRuntime,
    nowISO: NOW_ISO,
    threadId: `ct_${workId}`,
    subject: "Prospect inquiry response",
    channel: "email",
    participants: [{ id: "tm_leasing", type: "human" }, { id: partyId, type: "external_system" }],
    partyId,
    relatedWorkItemIds: [workId],
    messages: [{
      id: `cm_${workId}`,
      direction: "outbound",
      channel: "email",
      subject: "Re: 2BR availability",
      body: "Thank you for your interest.",
      sender: { id: "tm_leasing", type: "human" },
      recipients: [{ id: partyId, type: "external_system" }],
      nowISO: NOW_ISO,
      draftedAtISO: NOW_ISO,
      queuedAtISO: NOW_ISO,
    }],
  });

  recordInteractionWithOutcome({
    stack,
    interactionId,
    workId,
    requestId,
    partyId,
    noteText: exactNote,
    outcome: "showing_requested",
    followUpAt: "2026-07-05T14:00:00.000Z",
  });

  const showingWorkId = `work_pm_showing_${interactionId}`;
  const showingWork = stack.workRuntime.getWorkItem(showingWorkId);
  assert.ok(showingWork, "showing coordination work should exist");
  assert.equal(String(showingWork.workType), "showing_coordination");
  assert.notEqual(String(stack.workRuntime.getWorkItem(workId).assignedTo), "unassigned");

  const interaction = stack.interactionRuntime.getInteraction(interactionId);
  assert.equal(interaction.notes[0].text, exactNote);

  const dataPoints = stack.analyticsRuntime.getDataPoints();
  assert.ok(dataPoints.some((d) => d.metricId === "interaction_outcome_recorded_count"));
  const runs = stack.automationRuntime.getRuns();
  const showingRun = runs.find((r) =>
    (r.plannedActions ?? []).some((a) => String(a.parameters?.workType ?? "") === "showing_coordination"),
  );
  assert.ok(showingRun, "showing automation run should exist");
  assert.equal(showingRun.status, "COMPLETED");

  const engagement = new EngagementViewAdapter({ nowISO: NOW_ISO }).translate({
    partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
    analyticsRuntime: stack.analyticsRuntime,
  });
  assert.ok(engagement.timeline.length >= 3, "engagement timeline should reflect connected history");
  assert.ok(
    engagement.timeline.some((t) => t.type === TIMELINE_ITEM_TYPES.INTERACTION_NOTE_ADDED && t.description === exactNote),
    "engagement timeline should preserve exact human note",
  );

  const requestView = new RequestViewAdapter({ nowISO: NOW_ISO }).translate({
    requestRuntime: stack.requestRuntime,
    companyRuntime: stack.companyRuntime,
    teamRuntime: stack.teamRuntime,
    workRuntime: stack.workRuntime,
  });
  assert.ok((requestView.items ?? []).some((r) => String(r.id) === requestId));
  assert.ok(stack.capabilityRuntime.getCapability("showing_coordination"));
});

test("PM Scenario B: Resident maintenance → coordination work", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO, workspaceId: "ws_pm_b" });
  const partyId = "party_resident_b";
  const requestId = "req_maintenance_b";
  const interactionId = `int_${requestId}`;
  const exactNote = "Resident reports kitchen sink leak; needs coordination today.";

  seedPartyWithRelationship({
    businessGraphRuntime: stack.businessGraphRuntime,
    partyId,
    displayName: "Jordan Kim",
    relationshipType: "RESIDENT",
    nowISO: NOW_ISO,
  });

  const { workId } = convertRequest({
    stack,
    requestId,
    requestType: "MAINTENANCE_REQUEST",
    title: "Maintenance — kitchen sink leak",
    description: "Resident maintenance request.",
    partyId,
  });

  const communicationService = new RecordCommunicationService();
  communicationService.execute({
    communicationRuntime: stack.communicationRuntime,
    nowISO: NOW_ISO,
    threadId: `ct_${workId}`,
    subject: "Maintenance acknowledgment",
    channel: "email",
    participants: [{ id: "tm_maintenance", type: "human" }, { id: partyId, type: "external_system" }],
    partyId,
    relatedWorkItemIds: [workId],
    messages: [{
      id: `cm_ack_${workId}`,
      direction: "outbound",
      channel: "email",
      subject: "Maintenance request received",
      body: "We received your maintenance request.",
      sender: { id: "tm_maintenance", type: "human" },
      recipients: [{ id: partyId, type: "external_system" }],
      nowISO: NOW_ISO,
      draftedAtISO: NOW_ISO,
      queuedAtISO: NOW_ISO,
    }],
  });

  recordInteractionWithOutcome({
    stack,
    interactionId,
    workId,
    requestId,
    partyId,
    noteText: exactNote,
    outcome: "maintenance_coordination_required",
  });

  const maintenanceWorkId = `work_pm_maintenance_${interactionId}`;
  const maintenanceWork = stack.workRuntime.getWorkItem(maintenanceWorkId);
  assert.ok(maintenanceWork);
  assert.equal(String(maintenanceWork.workType), "maintenance_coordination");
  assert.equal(stack.interactionRuntime.getInteraction(interactionId).notes[0].text, exactNote);

  const engagement = new EngagementViewAdapter({ nowISO: NOW_ISO }).translate({
    partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
  });
  assert.ok(engagement.timeline.length >= 3);
});

test("PM Scenario C: Owner request → approval gate → grant executes once", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO, workspaceId: "ws_pm_c_grant" });
  const partyId = "party_owner_c";
  const requestId = "req_owner_c";
  const interactionId = `int_${requestId}`;
  const exactNote = "Owner requested approval before sending portfolio update to investors.";

  seedPartyWithRelationship({
    businessGraphRuntime: stack.businessGraphRuntime,
    partyId,
    displayName: "Harbor View Holdings",
    relationshipType: "OWNER",
    nowISO: NOW_ISO,
  });

  const { workId } = convertRequest({
    stack,
    requestId,
    requestType: "OWNER_REQUEST",
    title: "Owner portfolio update approval",
    description: "Owner request requiring authorization.",
    partyId,
  });

  recordInteractionWithOutcome({
    stack,
    interactionId,
    workId,
    requestId,
    partyId,
    noteText: exactNote,
    outcome: "owner_approval_required",
  });

  const ownerWorkId = `work_pm_owner_${interactionId}`;
  assert.equal(stack.workRuntime.getWorkItem(ownerWorkId), null, "work must not exist before approval");

  const run = stack.automationRuntime.getRuns()[0];
  assert.equal(run.status, "WAITING_FOR_APPROVAL");
  const approvalId = run.executionResults[0].output.approvalId;

  let engagement = new EngagementViewAdapter({ nowISO: NOW_ISO }).translate({
    partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
  });
  assert.ok(engagement.attention.items.length > 0 || engagement.nextActions.length > 0);

  stack.approvalRuntime.applyEvent({
    id: "evt_grant_owner",
    timestampISO: NOW_ISO,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED,
    payload: { approvalId, decidedAt: NOW_ISO },
  });

  const orchestration = new AutomationOrchestrationService({
    automationRuntime: stack.automationRuntime,
    automationRuleEngine: new AutomationRuleEngine(),
    actionExecutorRegistry: stack.actionExecutorRegistry,
    interactionRuntime: stack.interactionRuntime,
    automationPlatformEventPublisher: stack.automationPlatformEventPublisher,
    approvalRuntime: stack.approvalRuntime,
    approvalPlatformEventPublisher: stack.approvalPlatformEventPublisher,
  });
  orchestration.resumeAfterApproval({
    platformEvent: { payload: { approvalId } },
    context: { nowISO: NOW_ISO, workRuntime: stack.workRuntime },
  });

  assert.ok(stack.workRuntime.getWorkItem(ownerWorkId));
  assert.equal(stack.automationRuntime.getRunById(run.id).status, "COMPLETED");
  assert.equal(Number(stack.approvalRuntime.getMetrics()?.grantedRequests ?? 0), 1);
});

test("PM Scenario C rejection: owner approval rejected prevents work creation", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO, workspaceId: "ws_pm_c_reject" });
  const partyId = "party_owner_reject";
  const requestId = "req_owner_reject";
  const interactionId = `int_${requestId}`;

  seedPartyWithRelationship({
    businessGraphRuntime: stack.businessGraphRuntime,
    partyId,
    displayName: "Riverside Owner LLC",
    relationshipType: "OWNER",
    nowISO: NOW_ISO,
  });

  const { workId } = convertRequest({
    stack,
    requestId,
    requestType: "OWNER_REQUEST",
    title: "Owner update rejection path",
    description: "Owner request for rejection test.",
    partyId,
  });

  recordInteractionWithOutcome({
    stack,
    interactionId,
    workId,
    requestId,
    partyId,
    noteText: "Owner wants review before external send.",
    outcome: "owner_approval_required",
  });

  const ownerWorkId = `work_pm_owner_${interactionId}`;
  const run = stack.automationRuntime.getRuns()[0];
  const approvalId = run.executionResults[0].output.approvalId;

  stack.approvalRuntime.applyEvent({
    id: "evt_reject_owner",
    timestampISO: NOW_ISO,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REJECTED,
    payload: { approvalId, decidedAt: NOW_ISO },
  });

  stack.bus.dispatch(frozenApprovalPlatformEvent({ eventType: "APPROVAL_REJECTED", approvalId, nowISO: NOW_ISO }));

  assert.equal(stack.workRuntime.getWorkItem(ownerWorkId), null);
  assert.equal(stack.automationRuntime.getRunById(run.id).status, "CLOSED");
});

test("PM package install: terminology and configuration emerge without Core changes", () => {
  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO });
  assert.equal(stack.installationResult.packageId, "pkg_property_management");
  assert.equal(stack.installationResult.terminology.entityLabels.property, "Property");
  assert.equal(stack.installationResult.requestTypes.find((r) => r.id === "PROSPECT_INQUIRY").displayName, "Prospect Inquiry");
  assert.equal(stack.capabilityRuntime.getCapability("maintenance_coordination").name, "Maintenance Coordination");
  assert.equal(stack.automationRuntime.getAutomations().length, PROPERTY_MANAGEMENT_PACKAGE.automationConfigurations.length);
});
