import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { buildRequestForSeed } from "../request/RequestBuilder.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { RecordCommunicationService } from "../communications/use-cases/RecordCommunicationService.js";

const CONVERTED_AT_ISO = "2026-07-02T00:00:00.000Z";

/**
 * Secondary Horizon demo stories executed through canonical service boundaries.
 * Maintenance and owner approval — not the primary Taylor website inquiry loop.
 */
export function runHorizonSecondaryDemoScenarios({ stack, nowISO }) {
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const requestIds = [];

  if (!stack.requestRuntime.getRequest("req_maintenance_horizon")) {
    const maintenanceRequestId = "req_maintenance_horizon";
    const { workId: maintenanceWorkId } = convertRequest({
      stack,
      requestId: maintenanceRequestId,
      requestType: "MAINTENANCE_REQUEST",
      title: "Maintenance — kitchen sink leak",
      description: "Resident maintenance request.",
      partyId: "party_resident_horizon",
      assignedTeamMemberId: "tm_maintenance",
      nowISO: effectiveNowISO,
    });
    recordCommunication({
      stack,
      workId: maintenanceWorkId,
      partyId: "party_resident_horizon",
      subject: "Maintenance request received",
      body: "We received your maintenance request and are coordinating service.",
      assigneeId: "tm_maintenance",
      nowISO: effectiveNowISO,
    });
    recordInteractionWithOutcome({
      stack,
      interactionId: `int_${maintenanceRequestId}`,
      workId: maintenanceWorkId,
      requestId: maintenanceRequestId,
      partyId: "party_resident_horizon",
      noteText: "Resident reports kitchen sink leak; needs coordination today.",
      outcome: "maintenance_coordination_required",
      nowISO: effectiveNowISO,
    });
    requestIds.push(maintenanceRequestId);
  }

  if (!stack.requestRuntime.getRequest("req_owner_horizon")) {
    const ownerRequestId = "req_owner_horizon";
    const { workId: ownerWorkId } = convertRequest({
      stack,
      requestId: ownerRequestId,
      requestType: "OWNER_REQUEST",
      title: "Owner portfolio update approval",
      description: "Owner request requiring authorization before external send.",
      partyId: "party_owner_horizon",
      assignedTeamMemberId: "tm_owner_relations",
      nowISO: effectiveNowISO,
    });
    recordInteractionWithOutcome({
      stack,
      interactionId: `int_${ownerRequestId}`,
      workId: ownerWorkId,
      requestId: ownerRequestId,
      partyId: "party_owner_horizon",
      noteText: "Owner requested approval before sending portfolio update to investors.",
      outcome: "owner_approval_required",
      nowISO: effectiveNowISO,
    });
    requestIds.push(ownerRequestId);
  }

  return {
    requestIds,
    pendingApprovalRunId: stack.automationRuntime.getRuns().find((r) => r.status === "WAITING_FOR_APPROVAL")?.id ?? null,
  };
}

function convertRequest({ stack, requestId, requestType, title, description, partyId, nowISO, assignedTeamMemberId = null }) {
  const { requestRuntime, workRuntime, businessGraphRuntime, osRequestPublisher, osWorkPublisher } = stack;
  const workId = `work_${requestId}`;

  requestRuntime.applyEvent({
    id: `evt_req_received_${requestId}`,
    timestampISO: nowISO,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "horizon_secondary_demo",
    payload: {
      request: buildRequestForSeed({
        nowISO,
        overrides: {
          id: requestId,
          title,
          description,
          requestType,
          status: "received",
          priority: "medium",
          channel: "api",
          source: "horizon-secondary-demo",
          requester: partyId,
          metadata: { requiredCapabilities: [] },
        },
      }),
    },
  });

  businessGraphRuntime.applyEvent({
    id: `evt_rel_req_${requestId}_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "horizon_secondary_demo",
    payload: {
      relationship: {
        id: `rel_req_${requestId}_${partyId}`,
        fromEntity: { entityType: ENTITY_TYPES.REQUEST, entityId: requestId },
        toEntity: { entityType: ENTITY_TYPES.PARTY, entityId: partyId },
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

  requestRuntime.applyEvent({
    id: `evt_req_qualified_${requestId}`,
    timestampISO: nowISO,
    type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
    source: "horizon_secondary_demo",
    payload: { requestId, qualificationStatus: "triaged" },
  });

  const requestConvertedEvent = {
    id: `evt_req_converted_${requestId}`,
    timestampISO: CONVERTED_AT_ISO,
    type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
    source: "horizon_secondary_demo",
    payload: {
      requestId,
      assignedWorkId: workId,
      assignedTeamMemberId: assignedTeamMemberId ?? null,
      qualificationStatus: "triaged",
    },
  };
  requestRuntime.applyEvent(requestConvertedEvent);
  osRequestPublisher.publishRequestConverted({
    requestRuntime,
    requestConvertedEvent,
    convertedAtISO: CONVERTED_AT_ISO,
  });

  return { workId, createdWorkItem: workRuntime.getWorkItem(workId) };
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
  nowISO,
}) {
  if (stack.interactionRuntime.getInteraction(interactionId)) return;
  const recordInteractionService = new RecordInteractionService({
    interactionPlatformEventPublisher: stack.osInteractionPublisher,
  });
  recordInteractionService.execute({
    interactionRuntime: stack.interactionRuntime,
    interactionInput: {
      id: interactionId,
      interactionType: "call",
      direction: "outbound",
      channel: "phone",
      occurredAt: nowISO,
      participants: [{ partyId, participantType: "PERSON" }],
      relatedObjects: [{ workItemId: workId }, { requestId }, { partyId }],
      ownerId: "tm_leasing",
      status: "active",
      summary: "Property management interaction",
      createdAt: nowISO,
      updatedAt: nowISO,
      notes: [],
      outcome: null,
      nextStep: null,
      followUpAt: null,
      source: "horizon_secondary_demo",
      externalReference: null,
      metadata: {},
    },
    noteText,
    noteAuthorId: "tm_leasing",
    noteTimestampISO: nowISO,
    outcome,
    nextStep: outcome,
    followUpAt,
    nowISO,
    metadata: {},
  });
}

function recordCommunication({ stack, workId, partyId, subject, body, assigneeId, nowISO }) {
  const communicationService = new RecordCommunicationService();
  communicationService.execute({
    communicationRuntime: stack.communicationRuntime,
    nowISO,
    threadId: `ct_${workId}`,
    subject,
    channel: "email",
    participants: [
      { id: assigneeId, type: "human" },
      { id: partyId, type: "external_system" },
    ],
    partyId,
    relatedWorkItemIds: [workId],
    messages: [
      {
        id: `cm_${workId}`,
        direction: "outbound",
        channel: "email",
        subject,
        body,
        sender: { id: assigneeId, type: "human" },
        recipients: [{ id: partyId, type: "external_system" }],
        nowISO,
        draftedAtISO: nowISO,
        queuedAtISO: nowISO,
      },
    ],
  });
}
