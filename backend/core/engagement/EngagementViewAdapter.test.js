import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { buildRequestForSeed } from "../request/RequestBuilder.js";
import { WorkRuntime } from "../work/WorkRuntime.js";
import { CommunicationRuntime } from "../communications/CommunicationRuntime.js";
import { RecordCommunicationService } from "../communications/use-cases/RecordCommunicationService.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { AutomationRuntime } from "../automations/AutomationRuntime.js";
import { AutomationRuleEngine } from "../automations/engine/AutomationRuleEngine.js";
import { AutomationOrchestrationService } from "../automations/AutomationOrchestrationService.js";
import { createDefaultAutomationActionExecutorRegistry } from "../automations/actions/AutomationActionExecutorRegistry.js";
import { installAutomationTemplate } from "../automations/templates/AutomationTemplateInstaller.js";
import { OUTCOME_CREATES_WORK_TEMPLATE } from "../automations/templates/AutomationTemplateRegistry.js";
import {
  buildUniversalityConfiguration,
  UNIVERSALITY_TEST_CONFIGS,
  buildExternalResponseAutomationConfiguration,
} from "../automations/install/WorkspaceAutomationInstaller.js";
import { ApprovalRuntime } from "../approvals/ApprovalRuntime.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "../approvals/ApprovalEventTypes.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { EngagementViewAdapter } from "./EngagementViewAdapter.js";
import { TIMELINE_ITEM_TYPES } from "./EngagementDefaults.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOTE_TEXT = "Spoke with contact. Exact human note must remain unchanged.";
const MOCK_INTERACTION_PUBLISHER = {
  publishInteractionRecorded: () => {},
  publishInteractionOutcomeRecorded: () => {},
  publishFollowUpScheduled: () => {},
};

function seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO }) {
  businessGraphRuntime.applyEvent({
    id: `evt_party_created_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "engagement_test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "Test Person",
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: nowISO,
        updatedAt: nowISO,
      },
    },
  });

  requestRuntime.applyEvent({
    id: `evt_req_received_${requestId}`,
    timestampISO: nowISO,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "engagement_test",
    payload: {
      request: buildRequestForSeed({
        nowISO,
        overrides: {
          id: requestId,
          title: "Engagement test request",
          description: "Deterministic request",
          requestType: "intake",
          status: "received",
          priority: "medium",
          channel: "api",
          source: "test",
          receivedAt: nowISO,
          createdAt: nowISO,
          updatedAt: nowISO,
        },
      }),
    },
  });

  businessGraphRuntime.applyEvent({
    id: `evt_rel_${requestId}_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "engagement_test",
    payload: {
      relationship: {
        id: `rel_${requestId}_${partyId}`,
        fromEntity: { entityType: "Request", entityId: requestId },
        toEntity: { entityType: "Party", entityId: partyId },
        relationshipType: "REQUESTED_BY",
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

function recordInteraction({
  interactionRuntime,
  interactionPlatformEventPublisher,
  interactionId,
  partyId,
  requestId,
  workId,
  outcome,
  followUpAt,
  nowISO,
}) {
  const recordInteractionService = new RecordInteractionService({
    interactionPlatformEventPublisher: interactionPlatformEventPublisher ?? MOCK_INTERACTION_PUBLISHER,
  });
  recordInteractionService.execute({
    interactionRuntime,
    interactionInput: {
      id: interactionId,
      interactionType: "call",
      direction: "outbound",
      channel: "phone",
      occurredAt: nowISO,
      participants: [{ partyId, participantType: "PERSON" }],
      relatedObjects: [{ workItemId: workId }, { requestId }, { partyId }],
      ownerId: "tm_owner",
      status: "active",
      summary: "Test interaction",
      createdAt: nowISO,
      updatedAt: nowISO,
      notes: [],
      outcome: null,
      nextStep: null,
      followUpAt: null,
      source: "engagement_test",
      externalReference: null,
      metadata: {},
    },
    noteText: NOTE_TEXT,
    noteAuthorId: "tm_owner",
    noteTimestampISO: nowISO,
    outcome,
    nextStep: "next_step_value",
    followUpAt,
    nowISO,
    metadata: {},
  });
}

function seedSubject(businessSubjectRuntime, { subjectId = "subj_main", displayName = "123 Main St" } = {}) {
  businessSubjectRuntime.applyEvent({
    id: `evt_subject_${subjectId}`,
    timestampISO: NOW0,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "engagement_test",
    payload: {
      subject: {
        id: subjectId,
        workspaceId: "ws_engagement_test",
        subjectType: "listing",
        displayName,
        status: "active",
        keyAttributes: { address: displayName },
        externalReferences: [],
        createdAt: NOW0,
        updatedAt: NOW0,
      },
    },
  });
}

test("EngagementViewAdapter: produces immutable party view without mutating runtimes", () => {
  const partyId = "party_eng_1";
  const requestId = "req_eng_1";
  const workId = "work_eng_1";
  const interactionId = "int_eng_1";

  const businessGraphRuntime = new BusinessGraphRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const approvalRuntime = new ApprovalRuntime({ nowISO: NOW0 });

  seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });

  const graphBefore = businessGraphRuntime.getParties().length;
  const adapter = new EngagementViewAdapter({ nowISO: NOW0 });
  const vm = adapter.translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
  });

  assert.equal(businessGraphRuntime.getParties().length, graphBefore);
  assert.ok(Object.isFrozen(vm));
  assert.equal(vm.partyId, partyId);
  assert.equal(vm.party.displayName, "Test Person");
});

test("EngagementViewAdapter: preserves exact human note text in timeline", () => {
  const partyId = "party_note_1";
  const requestId = "req_note_1";
  const workId = "work_note_1";
  const interactionId = "int_note_1";

  const businessGraphRuntime = new BusinessGraphRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });

  seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });
  recordInteraction({
    interactionRuntime,
    interactionId,
    partyId,
    requestId,
    workId,
    outcome: "review_required",
    followUpAt: "2026-07-10T00:00:00.000Z",
    nowISO: NOW0,
  });

  const vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
  });

  const noteItem = vm.timeline.find((t) => t.type === TIMELINE_ITEM_TYPES.INTERACTION_NOTE_ADDED);
  assert.ok(noteItem);
  assert.equal(noteItem.description, NOTE_TEXT);
  assert.equal(noteItem.metadata.exactHumanNote, true);
});

test("Engagement universality: three configurations, same engagement adapter", () => {
  for (const [name, overrides] of Object.entries(UNIVERSALITY_TEST_CONFIGS)) {
    const partyId = `party_uni_${name}`;
    const requestId = `req_uni_${name}`;
    const workId = `work_uni_${name}`;
    const interactionId = `int_uni_${name}`;

    const businessGraphRuntime = new BusinessGraphRuntime();
    const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
    const workRuntime = new WorkRuntime({ nowISO: NOW0 });
    const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
    const interactionRuntime = new InteractionRuntime();
    const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });

    seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });

    installAutomationTemplate({
      template: OUTCOME_CREATES_WORK_TEMPLATE,
      configuration: buildUniversalityConfiguration({ ...overrides, actionId: `act_${name}`, assignedTo: "tm_owner" }),
      automationRuntime,
      nowISO: NOW0,
    });

    recordInteraction({
      interactionRuntime,
      interactionId,
      partyId,
      requestId,
      workId,
      outcome: overrides.outcomeValue,
      followUpAt: "2026-07-10T00:00:00.000Z",
      nowISO: NOW0,
    });

    const orchestration = new AutomationOrchestrationService({
      automationRuntime,
      automationRuleEngine: new AutomationRuleEngine(),
      actionExecutorRegistry: createDefaultAutomationActionExecutorRegistry({
        workPlatformEventPublisher: { publishWorkCreated: () => ({ status: "PUBLISHED" }) },
      }),
      interactionRuntime,
    });

    orchestration.orchestratePlatformEvent({
      platformEvent: {
        eventId: `evt_outcome_${interactionId}`,
        eventType: "INTERACTION_OUTCOME_RECORDED",
        payload: { interactionId, outcome: overrides.outcomeValue, followUpAt: "2026-07-10T00:00:00.000Z" },
      },
      context: { nowISO: NOW0, workRuntime },
    });

    const vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
      partyId,
      businessGraphRuntime,
      requestRuntime,
      workRuntime,
      communicationRuntime,
      interactionRuntime,
      automationRuntime,
    });

    assert.ok(vm.interactions.length >= 1, `${name} has interactions`);
    assert.ok(vm.timeline.some((t) => t.type === TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED));
    assert.equal(vm.interactions[0].outcome, overrides.outcomeValue);
  }
});

test("Engagement approval proof: pending approval visible, grant creates work once", () => {
  const partyId = "party_appr_1";
  const requestId = "req_appr_1";
  const workId = "work_appr_1";
  const interactionId = "int_appr_1";
  const followUpAt = "2026-07-10T00:00:00.000Z";

  const businessGraphRuntime = new BusinessGraphRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const approvalRuntime = new ApprovalRuntime({ nowISO: NOW0 });

  seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });

  installAutomationTemplate({
    template: OUTCOME_CREATES_WORK_TEMPLATE,
    configuration: buildExternalResponseAutomationConfiguration(),
    automationRuntime,
    nowISO: NOW0,
  });

  recordInteraction({
    interactionRuntime,
    interactionId,
    partyId,
    requestId,
    workId,
    outcome: "external_response_required",
    followUpAt,
    nowISO: NOW0,
  });

  const orchestration = new AutomationOrchestrationService({
    automationRuntime,
    automationRuleEngine: new AutomationRuleEngine(),
    actionExecutorRegistry: createDefaultAutomationActionExecutorRegistry({
      workPlatformEventPublisher: { publishWorkCreated: () => ({ status: "PUBLISHED" }) },
    }),
    interactionRuntime,
    approvalRuntime,
  });

  orchestration.orchestratePlatformEvent({
    platformEvent: {
      eventId: `evt_outcome_${interactionId}`,
      eventType: "INTERACTION_OUTCOME_RECORDED",
      payload: { interactionId, outcome: "external_response_required", followUpAt },
    },
    context: { nowISO: NOW0, workRuntime },
  });

  const gatedWorkId = `work_auto_external_${interactionId}`;
  assert.equal(workRuntime.getWorkItem(gatedWorkId), null);

  let vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
  });

  assert.equal(vm.pendingApprovals.length, 1);
  assert.ok(vm.attention.items.some((a) => a.category === "pending_approval"));
  assert.ok(vm.nextActions.some((a) => a.requiresApproval));

  const approvalId = vm.pendingApprovals[0].id;
  approvalRuntime.applyEvent({
    id: "evt_grant",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED,
    payload: { approvalId, decidedAt: NOW0 },
  });

  orchestration.resumeAfterApproval({
    platformEvent: { payload: { approvalId } },
    context: { nowISO: NOW0, workRuntime },
  });

  assert.ok(workRuntime.getWorkItem(gatedWorkId));

  vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
  });

  assert.ok(vm.timeline.some((t) => t.type === TIMELINE_ITEM_TYPES.APPROVAL_GRANTED));
  assert.ok(vm.openWork.some((w) => String(w.id) === gatedWorkId));
});

test("EngagementViewAdapter hides invalid follow-up timestamps and humanizes implementation values", () => {
  const partyId = "party_followup_null";
  const requestId = "req_followup_null";
  const workId = "work_followup_null";
  const interactionId = "int_followup_null";

  const businessGraphRuntime = new BusinessGraphRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });

  seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });
  recordInteraction({
    interactionRuntime,
    interactionId,
    partyId,
    requestId,
    workId,
    outcome: "follow_up_required",
    followUpAt: null,
    nowISO: NOW0,
  });

  const vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
  });

  assert.equal(vm.followUps.length, 0);
  assert.equal(vm.timeline.some((item) => item.type === TIMELINE_ITEM_TYPES.FOLLOW_UP_SCHEDULED), false);
  const outcome = vm.timeline.find((item) => item.type === TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED);
  assert.ok(outcome);
  assert.equal(outcome.description, "Outcome: Follow Up Required · Next: Next Step Value");
  const relationship = vm.timeline.find((item) => item.type === TIMELINE_ITEM_TYPES.RELATIONSHIP_CREATED);
  assert.ok(relationship);
  assert.equal(relationship.description, "Request linked to this contact.");
  const visibleTimelineText = vm.timeline.map((item) => `${item.title} ${item.description}`).join(" ");
  assert.doesNotMatch(visibleTimelineText, new RegExp("Party/|Organization/|follow_up_required|Follow-up at null"));
});

test("EngagementViewAdapter shows property interest from request and interaction subject refs", () => {
  const partyId = "party_subject_refs";
  const requestId = "req_subject_refs";
  const subjectId = "subj_subject_refs";

  const businessGraphRuntime = new BusinessGraphRuntime();
  const requestRuntime = new RequestRuntime({ nowISO: NOW0 });
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const communicationRuntime = new CommunicationRuntime({ nowISO: NOW0 });
  const interactionRuntime = new InteractionRuntime();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const businessSubjectRuntime = new BusinessSubjectRuntime();

  seedSubject(businessSubjectRuntime, { subjectId, displayName: "123 Main St" });
  seedPartyGraph({ businessGraphRuntime, requestRuntime, partyId, requestId, nowISO: NOW0 });
  requestRuntime.applyEvent({
    id: "evt_req_subject_ref_patch",
    timestampISO: NOW0,
    type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
    source: "engagement_test",
    payload: {
      requestId,
      patch: { subjectRefs: [{ entityType: "Subject", entityId: subjectId }] },
    },
  });

  const vm = new EngagementViewAdapter({ nowISO: NOW0 }).translate({
    partyId,
    businessGraphRuntime,
    businessSubjectRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
  });

  assert.equal(vm.subjects.length, 1);
  assert.equal(vm.subjects[0].displayName, "123 Main St");
});
