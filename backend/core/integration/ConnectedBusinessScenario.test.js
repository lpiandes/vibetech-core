import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";

import { RequestRuntime } from "../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { buildRequestForSeed } from "../request/RequestBuilder.js";

import { WorkRuntime } from "../work/WorkRuntime.js";
import { TeamRuntime } from "../team/TeamRuntime.js";
import { CapabilityRuntime } from "../capabilities/runtime/CapabilityRuntime.js";

import { AnalyticsRuntime } from "../analytics/AnalyticsRuntime.js";

import { CommunicationRuntime } from "../communications/CommunicationRuntime.js";
import { RecordCommunicationService } from "../communications/use-cases/RecordCommunicationService.js";

import { PlatformEventStore } from "../events/PlatformEventStore.js";
import { PlatformEventBus } from "../events/bus/PlatformEventBus.js";
import { PlatformEventPublisherRegistry } from "../events/publishing/PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "../events/publishing/PlatformEventPublisher.js";

import { REQUEST_OS_PUBLISHER_ID } from "../request/events/RequestPlatformEventDefaults.js";
import { RequestPlatformEventPublisher } from "../request/events/RequestPlatformEventPublisher.js";
import { WORK_OS_PUBLISHER_ID } from "../work/events/WorkPlatformEventDefaults.js";
import { WorkPlatformEventPublisher } from "../work/events/WorkPlatformEventPublisher.js";

import { createPlatformEventSubscriberFromHandler } from "../events/subscribers/PlatformEventSubscriberFactory.js";
import { requestToWorkHandle } from "../pipelines/request-to-work/RequestToWorkSubscriber.js";
import { createTeamAssignmentSubscriber } from "../pipelines/work-assignment/TeamAssignmentSubscriber.js";
import { createTeamWorkloadProjectionSubscriber } from "../pipelines/work-assignment/TeamWorkloadProjectionSubscriber.js";
import { createAnalyticsEventSubscriber } from "../analytics/subscribers/AnalyticsEventSubscriber.js";

import { RequestViewAdapter } from "../request/views/RequestViewAdapter.js";

import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";

import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { InteractionPlatformEventPublisher } from "../interactions/events/InteractionPlatformEventPublisher.js";
import { INTERACTION_OS_PUBLISHER_ID } from "../interactions/events/InteractionPlatformEventDefaults.js";

import { AutomationRuntime } from "../automations/AutomationRuntime.js";
import { AutomationRuleEngine } from "../automations/engine/AutomationRuleEngine.js";
import { createAutomationEventSubscriber } from "../automations/subscribers/AutomationEventSubscriber.js";
import { createDefaultAutomationActionExecutorRegistry } from "../automations/actions/AutomationActionExecutorRegistry.js";
import { AutomationPlatformEventPublisher } from "../automations/events/AutomationPlatformEventPublisher.js";
import { AUTOMATION_OS_PUBLISHER_ID } from "../automations/events/AutomationPlatformEventDefaults.js";
import {
  installConnectedDemoAutomation,
  buildConnectedDemoAutomationConfiguration,
} from "../automations/install/WorkspaceAutomationInstaller.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { TIMELINE_ITEM_TYPES } from "../engagement/EngagementDefaults.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const CONVERTED_AT_ISO = "2026-07-02T00:00:00.000Z";

test("Connected scenario: request conversion ripples through work, assignment, analytics", () => {
  const requestId = "req_connected_1";
  const workId = `work_${requestId}`;
  const partyId = `party_person_${requestId}`;
  const partyDisplayName = "Rachael Nguyen";

  const companyRuntime = new CompanyWorkspaceRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW_ISO });
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const teamRuntime = new TeamRuntime();
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const analyticsRuntime = new AnalyticsRuntime({ seed: null, nowISO: NOW_ISO });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW_ISO });
  const businessGraphRuntime = new BusinessGraphRuntime();
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW_ISO });
  const automationRuleEngine = new AutomationRuleEngine();

  // Scenario 4.0: Automation Core starts empty — demo behavior comes from installed template configuration.
  assert.equal(automationRuntime.getAutomations().length, 0);
  assert.equal(automationRuntime.getRuns().length, 0);
  assert.equal(Number(automationRuntime.getMetrics()?.totalRuns ?? 0), 0);

  const installedDemoAutomation = installConnectedDemoAutomation({
    automationRuntime,
    configuration: buildConnectedDemoAutomationConfiguration(),
    nowISO: NOW_ISO,
  });
  const automationId = installedDemoAutomation.automationId;
  assert.equal(automationRuntime.getAutomations().length, 1);

  // Platform infrastructure.
  const store = new PlatformEventStore({ nowISO: NOW_ISO });
  const bus = new PlatformEventBus({ nowISO: NOW_ISO });
  const publisherRegistry = new PlatformEventPublisherRegistry({
    publishers: [
      {
        id: REQUEST_OS_PUBLISHER_ID,
        name: "Request OS",
        operatingSystem: "request_os",
        allowedEventTypes: ["REQUEST_CONVERTED"],
        version: 1,
        metadata: {},
      },
      {
        id: WORK_OS_PUBLISHER_ID,
        name: "Work OS",
        operatingSystem: "work_os",
        allowedEventTypes: ["WORK_CREATED", "WORK_ASSIGNED"],
        version: 1,
        metadata: {},
      },
      {
        id: INTERACTION_OS_PUBLISHER_ID,
        name: "Interaction OS",
        operatingSystem: "interaction_os",
        allowedEventTypes: ["INTERACTION_RECORDED", "INTERACTION_OUTCOME_RECORDED", "FOLLOW_UP_SCHEDULED"],
        version: 1,
        metadata: {},
      },
      {
        id: AUTOMATION_OS_PUBLISHER_ID,
        name: "Automation OS",
        operatingSystem: "automation_os",
        allowedEventTypes: ["AUTOMATION_RUN_STARTED", "AUTOMATION_RUN_COMPLETED", "AUTOMATION_RUN_FAILED"],
        version: 1,
        metadata: {},
      },
    ],
  });

  const requestPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: REQUEST_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW_ISO,
  });
  const workPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: WORK_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW_ISO,
  });

  const osRequestPublisher = new RequestPlatformEventPublisher({ platformEventPublisher: requestPublisher });
  const osWorkPublisher = new WorkPlatformEventPublisher({ platformEventPublisher: workPublisher });
  const interactionPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: INTERACTION_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW_ISO,
  });
  const osInteractionPublisher = new InteractionPlatformEventPublisher({ platformEventPublisher: interactionPublisher });

  const automationPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: AUTOMATION_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW_ISO,
  });
  const automationPlatformEventPublisher = new AutomationPlatformEventPublisher({ platformEventPublisher: automationPublisher });

  // Subscribers (runtime-bound, deterministic).
  const requestToWorkSubscriber = createPlatformEventSubscriberFromHandler({
    id: "sub_req_to_work_connected",
    name: "RequestToWorkSubscriber (connected)",
    operatingSystem: "request_to_work_pipeline",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    enabled: true,
    handler: (event) => requestToWorkHandle(event, { workRuntime }),
    handlerMetadata: { version: 1 },
  });

  const teamAssignmentSubscriber = createTeamAssignmentSubscriber({
    workRuntime,
    teamRuntime,
    capabilityRuntime,
    workAssignmentPlatformPublisher: osWorkPublisher,
    id: "sub_team_assignment_connected",
    name: "TeamAssignmentSubscriber (connected)",
    priority: 0,
    enabled: true,
  });

  const analyticsSubscriber = createAnalyticsEventSubscriber({
    id: "sub_analytics_connected",
    name: "AnalyticsEventSubscriber (connected)",
    operatingSystem: "analytics_event_subscribers",
    analyticsRuntime,
    supportedEvents: [
      "REQUEST_CONVERTED",
      "WORK_CREATED",
      "WORK_ASSIGNED",
      "INTERACTION_RECORDED",
      "INTERACTION_OUTCOME_RECORDED",
      "FOLLOW_UP_SCHEDULED",
      "AUTOMATION_RUN_STARTED",
      "AUTOMATION_RUN_COMPLETED",
      "AUTOMATION_RUN_FAILED",
    ],
    priority: 0,
    enabled: true,
  });

  const teamWorkloadProjectionSubscriber = createTeamWorkloadProjectionSubscriber({
    teamRuntime,
    id: "sub_team_workload_projection_connected",
    name: "TeamWorkloadProjectionSubscriber (connected)",
    priority: 0,
    enabled: true,
  });

  // Wire subscriptions.
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber: requestToWorkSubscriber });
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber: teamAssignmentSubscriber });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "WORK_ASSIGNED", subscriber: teamWorkloadProjectionSubscriber });
  bus.subscribe({ eventType: "WORK_ASSIGNED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "INTERACTION_RECORDED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "INTERACTION_OUTCOME_RECORDED", subscriber: analyticsSubscriber });

  const actionExecutorRegistry = createDefaultAutomationActionExecutorRegistry({ workPlatformEventPublisher: osWorkPublisher });
  const automationEventSubscriber = createAutomationEventSubscriber({
    id: "sub_automation_event_connected",
    name: "AutomationEventSubscriber (connected)",
    operatingSystem: "automation_event_subscribers",
    automationRuntime,
    automationRuleEngine,
    actionExecutorRegistry,
    interactionRuntime,
    workRuntime,
    automationPlatformEventPublisher,
    priority: 0,
    enabled: true,
  });
  bus.subscribe({ eventType: "INTERACTION_OUTCOME_RECORDED", subscriber: automationEventSubscriber });

  bus.subscribe({ eventType: "AUTOMATION_RUN_STARTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "AUTOMATION_RUN_COMPLETED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "AUTOMATION_RUN_FAILED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "FOLLOW_UP_SCHEDULED", subscriber: analyticsSubscriber });

  // Seed RequestRuntime to allow conversion.
  businessGraphRuntime.applyEvent({
    id: `evt_party_created_${partyId}`,
    timestampISO: NOW_ISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test_connected_business_scenario",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: partyDisplayName,
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      },
    },
  });

  const receivedEvent = {
    id: `evt_req_received_${requestId}`,
    timestampISO: NOW_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test_connected_business",
    payload: {
      request: buildRequestForSeed({
        nowISO: NOW_ISO,
        overrides: {
          id: requestId,
          title: "Customer intake",
          description: "Deterministic request for connected scenario.",
          requestType: "intake",
          status: "received",
          priority: "medium",
          channel: "api",
          source: "demo-seed",
          requester: "prospective-client",
          dueAt: null,
          assignedWorkId: null,
          assignedTeamMemberId: null,
          qualificationStatus: null,
          attachments: [],
          metadata: {
            requiredCapabilities: [],
          },
        },
      }),
    },
  };
  requestRuntime.applyEvent(receivedEvent);

  // Link Request -> Party via generic relationship (event-only).
  businessGraphRuntime.applyEvent({
    id: `evt_rel_created_${requestId}_${partyId}`,
    timestampISO: NOW_ISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test_connected_business_scenario",
    payload: {
      relationship: {
        id: `rel_${requestId}_${partyId}`,
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
    source: "test_connected_business",
    payload: { requestId, qualificationStatus: "triaged" },
  });

  // Apply internal conversion and publish canonical platform event.
  const requestConvertedEvent = {
    id: `evt_req_converted_${requestId}`,
    timestampISO: CONVERTED_AT_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
    source: "test_connected_business",
    payload: {
      requestId,
      assignedWorkId: null,
      assignedTeamMemberId: null,
      qualificationStatus: "triaged",
    },
  };
  requestRuntime.applyEvent(requestConvertedEvent);

  const publishConversion = osRequestPublisher.publishRequestConverted({
    requestRuntime,
    requestConvertedEvent,
    convertedAtISO: CONVERTED_AT_ISO,
  });

  assert.equal(publishConversion.status, "PUBLISHED");
  assert.equal(workRuntime.getWorkItem(workId) ? "ok" : "missing", "ok");

  // Publish canonical WORK_CREATED.
  const createdWorkItem = workRuntime.getWorkItem(workId);
  assert.ok(createdWorkItem, "workRuntime should contain created work item");

  const teamMetricsBefore = teamRuntime.getMetrics();
  const teamPendingBefore = Number(teamMetricsBefore.pendingWork ?? 0);
  const teamAssignedBefore = Number(teamMetricsBefore.assignedWork ?? 0);

  const publishWorkCreated = osWorkPublisher.publishWorkCreated({
    workRuntime,
    createdWorkItem,
    createdAtISO: CONVERTED_AT_ISO,
  });
  assert.equal(publishWorkCreated.status, "PUBLISHED");

  // Verify team assignment effect on WorkRuntime.
  const updatedWorkItem = workRuntime.getWorkItem(workId);
  assert.ok(updatedWorkItem, "workRuntime should still contain work item");
  assert.notEqual(String(updatedWorkItem.assignedTo), "unassigned");

  // WORK_ASSIGNED should be published + projected via subscribers.
  // (We validate the actual projection later using the stored WORK_ASSIGNED event.)

  // Verify request conversion happens exactly once: only one REQUEST_CONVERTED platform event.
  const conversionPlatformEvents = store.getEventsByType("REQUEST_CONVERTED");
  assert.equal(conversionPlatformEvents.length, 1);
  assert.ok(String(conversionPlatformEvents[0].eventId).includes(`evt_request_converted_${requestId}_`));

  // Verify RequestViewAdapter enrichment: no request-history rewriting, but downstream ownership appears in view.
  const requestView = new RequestViewAdapter({ nowISO: NOW_ISO }).translate({
    requestRuntime,
    companyRuntime,
    teamRuntime,
    workRuntime,
    nowISO: NOW_ISO,
  });
  const reqItem = (requestView.items ?? []).find((x) => String(x.id) === requestId);
  assert.ok(reqItem, "request view item should exist");
  assert.equal(String(reqItem.assignedWorkId), workId);
  assert.equal(String(reqItem.assignedTeamMemberId), String(updatedWorkItem.assignedTo));

  // Verify business graph party + relationship exist.
  const party = businessGraphRuntime.getParty(partyId);
  assert.ok(party);
  const relationship = businessGraphRuntime.getRelationship(`rel_${requestId}_${partyId}`);
  assert.ok(relationship);

  // Communication use case: creates thread/message state via runtime events (no scenario-level seeding).
  const threadId = `ct_${workId}`;
  const messageQueuedId = `cm_queued_${workId}`;
  const messageFailedId = `cm_failed_${workId}`;
  const messageReceivedId = `cm_received_${workId}`;

  const communicationService = new RecordCommunicationService();
  communicationService.execute({
    communicationRuntime,
    nowISO: NOW_ISO,
    threadId,
    subject: "Connected communications follow-up",
    channel: "internal",
    participants: [
      { id: "tm_ceo", type: "human" },
      { id: partyId, type: "external_system" },
    ],
    partyId,
    relatedWorkItemIds: [workId],
    messages: [
      {
        id: messageQueuedId,
        direction: "outbound",
        channel: "email",
        subject: "Queued exec update",
        body: "Draft body for queued exec update.",
        sender: { id: "tm_ceo", type: "human" },
        recipients: [{ id: partyId, type: "external_system" }],
        nowISO: "2026-06-20T00:00:00.000Z",
        draftedAtISO: "2026-06-20T00:00:00.000Z",
        queuedAtISO: NOW_ISO,
      },
      {
        id: messageFailedId,
        direction: "outbound",
        channel: "internal",
        subject: "Failed follow-up",
        body: "Body for a message that will fail.",
        sender: { id: "tm_ceo", type: "human" },
        recipients: [{ id: partyId, type: "external_system" }],
        nowISO: "2026-06-25T00:00:00.000Z",
        draftedAtISO: "2026-06-25T00:00:00.000Z",
        failedAtISO: NOW_ISO,
      },
      {
        id: messageReceivedId,
        direction: "inbound",
        channel: "chat",
        subject: "Inbound requiring response",
        body: "Inbound body that needs response.",
        sender: null,
        recipients: [],
        nowISO: NOW_ISO,
        draftedAtISO: NOW_ISO,
        receivedAtISO: NOW_ISO,
      },
    ],
  });

  const receivedMsg = communicationRuntime.getMessage(messageReceivedId);
  assert.ok(receivedMsg);
  assert.equal(String(receivedMsg.status), "received");

  // Interaction use case: records note + outcome + follow-up and publishes supported platform events.
  const interactionId = `int_${workId}`;
  const interactionNoteText = "Spoke with the customer. They are interested but need more time. Follow up Friday afternoon.";
  const followUpAtISO = "2026-07-03T15:00:00.000Z";

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
      relatedObjects: [{ workItemId: workId }, { requestId }, { communicationThreadId: threadId }, { communicationMessageId: messageReceivedId }, { partyId }],
      ownerId: "tm_ceo",
      status: "active",
      summary: "Connected customer call recorded; follow-up required.",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      notes: [],
      outcome: null,
      nextStep: null,
      followUpAt: null,
      source: "test_connected_business_scenario_2_0",
      externalReference: null,
      metadata: {},
    },
    noteText: interactionNoteText,
    noteAuthorId: "tm_ceo",
    noteTimestampISO: NOW_ISO,
    outcome: "follow_up_required",
    nextStep: "call_back",
    followUpAt: followUpAtISO,
    nowISO: NOW_ISO,
    metadata: {},
  });

  const interaction = interactionRuntime.getInteraction(interactionId);
  assert.ok(interaction);
  assert.equal(interaction.notes?.[0]?.text, interactionNoteText);
  assert.equal(interaction.outcome, "follow_up_required");
  assert.equal(interaction.followUpAt, followUpAtISO);

  // Verify platform events stored for interaction + assignment.
  // Request→Work creates the original work; automation creates follow-up work too.
  assert.equal(store.getEventsByType("WORK_ASSIGNED").length, 2);
  assert.equal(store.getEventsByType("INTERACTION_RECORDED").length, 1);
  assert.equal(store.getEventsByType("INTERACTION_OUTCOME_RECORDED").length, 1);
  assert.equal(store.getEventsByType("FOLLOW_UP_SCHEDULED").length, 1);

  // Verify analytics datapoints exist for interaction and supported assignment.
  const dataPoints = analyticsRuntime.getDataPoints();
  assert.ok(dataPoints.some((d) => String(d.metricId) === "work_assigned_count"));
  assert.ok(dataPoints.some((d) => String(d.metricId) === "interaction_recorded_count"));
  assert.ok(dataPoints.some((d) => String(d.metricId) === "interaction_outcome_recorded_count"));
  assert.ok(dataPoints.some((d) => String(d.metricId) === "follow_up_scheduled_count"));

  // Connected-proof 4.0: installed template automation creates deterministic outcome work.
  const followUpWorkId = `work_auto_outcome_${interactionId}`;
  const followUpWork = workRuntime.getWorkItem(followUpWorkId);
  assert.ok(followUpWork, "installed automation template should create deterministic outcome work");
  assert.equal(String(followUpWork.workType), "relationship_follow_up");
  assert.equal(String(followUpWork.dueAt), followUpAtISO);
  assert.ok(
    (followUpWork.relatedObjects ?? []).some((o) => Object.prototype.hasOwnProperty.call(o, "partyId") && String(o.partyId) === partyId),
    "outcome work should preserve party linkage from interaction",
  );

  const triggerEventId = `evt_interaction_outcome_recorded_${interactionId}_${NOW_ISO}`;
  const safeTrigger = String(triggerEventId).replace(/[^a-zA-Z0-9_]/g, "_");
  const runId = `run_${String(automationId).replace(/[^a-zA-Z0-9_]/g, "_")}_${safeTrigger}`;
  const run = automationRuntime.getRunById(runId);
  assert.ok(run, "automation run should exist");
  assert.equal(run.status, "COMPLETED");
  assert.equal(automationRuntime.getRuns().length, 1, "no duplicate automation runs");

  // Analytics: automation run started/completed should be counted.
  assert.ok(dataPoints.some((d) => String(d.metricId) === "automation_run_started_count"));
  assert.ok(dataPoints.some((d) => String(d.metricId) === "automation_run_completed_count"));

  // Connected-proof 5.0: engagement read model reflects complete relationship loop.
  const engagementAdapter = new EngagementViewAdapter({ nowISO: NOW_ISO });
  const engagement = engagementAdapter.translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
  });

  assert.ok(Object.isFrozen(engagement));
  assert.equal(engagement.partyId, partyId);
  assert.ok(engagement.interactions.length >= 1);
  assert.equal(engagement.interactions[0].notes[0].text, interactionNoteText, "exact human note preserved");

  const timelineTypes = engagement.timeline.map((t) => t.type);
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.INTERACTION_RECORDED));
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.INTERACTION_NOTE_ADDED));
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED));
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.FOLLOW_UP_SCHEDULED));
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.AUTOMATION_RUN_COMPLETED));
  assert.ok(timelineTypes.includes(TIMELINE_ITEM_TYPES.WORK_CREATED));

  const noteTimelineItem = engagement.timeline.find((t) => t.type === TIMELINE_ITEM_TYPES.INTERACTION_NOTE_ADDED);
  assert.equal(noteTimelineItem.description, interactionNoteText);

  assert.ok(engagement.followUps.length >= 1);
  assert.ok(engagement.openWork.some((w) => String(w.id) === followUpWorkId));
  assert.ok(engagement.nextActions.length >= 1);

  for (let i = 1; i < engagement.timeline.length; i++) {
    const prev = new Date(engagement.timeline[i - 1].occurredAt).getTime();
    const cur = new Date(engagement.timeline[i].occurredAt).getTime();
    assert.ok(cur >= prev || engagement.timeline[i].id >= engagement.timeline[i - 1].id, "timeline must be chronologically ordered");
  }
});
