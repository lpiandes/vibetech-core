import { CONNECTION_EVENT_TYPES } from "../integrations/connections/ConnectionEventTypes.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { RecordCommunicationService } from "../communications/use-cases/RecordCommunicationService.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createCommunicationPreference } from "../communications/preferences/CommunicationPreference.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";
import { createExternalActionRequest } from "../integrations/actions/ExternalActionRequest.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  HORIZON_DEMO_FORM_SUBMISSION_ID,
  HORIZON_DEMO_MISSED_CALL_ID,
  buildWebsiteFormPayload,
  buildMissedCallPayload,
  getHorizonTaylorPartyId,
  getHorizonTaylorRequestId,
  HORIZON_DEMO_EXACT_QUALIFICATION_NOTE,
} from "./FirstClientOperatingLoopRunner.js";
import { runHorizonSecondaryDemoScenarios } from "./HorizonSecondaryDemoScenarios.js";
import { runHorizonDemoBusinessDayInputs } from "./HorizonDemoBusinessDay.js";
import {
  isHorizonBootstrapMarked,
  markHorizonBootstrapComplete,
  HORIZON_DEMO_BOOTSTRAP_VERSION,
} from "./HorizonDemoBootstrapRegistry.js";

export function isHorizonPrimaryLoopComplete({ stack }) {
  return Boolean(stack.requestRuntime?.getRequest?.(getHorizonTaylorRequestId()));
}

export function verifyDemoConnectionSync({
  connectionService,
  connectionRuntime,
  workspaceId,
  connectionType,
  providerType,
  displayName,
  nowISO,
}) {
  let conn = connectionRuntime.getConnections().find((c) => c.connectionType === connectionType);
  if (!conn) {
    conn = connectionService.registerRequirement({
      workspaceId,
      connectionType,
      displayName,
    });
  }
  if (conn.status === CONNECTION_STATUSES.NOT_CONNECTED) {
    connectionService.startConfiguration({ connectionId: conn.id, providerType });
    connectionService.attachMockCredentials({ connectionId: conn.id, providerType });
  }
  if (conn.status !== CONNECTION_STATUSES.CONNECTED) {
    connectionRuntime.applyEvent({
      id: `evt_demo_verified_${conn.id}`,
      timestampISO: nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_VERIFIED,
      source: "horizon_demo_bootstrap",
      payload: {
        connectionId: conn.id,
        verifiedAt: nowISO,
        capabilitiesVerified: conn.capabilities,
        health: deepFreeze({
          level: "HEALTHY",
          verifiedAt: nowISO,
          code: "demo_verified",
          message: "Demo connection active — workflow ready for production provider setup.",
        }),
      },
    });
  }
  return connectionRuntime.getConnection(conn.id);
}

function recordPartyOptIn({ stack, partyId, nowISO }) {
  const existing = stack.communicationPreferenceRuntime
    .getPreferencesForParty(partyId)
    .find((p) => p.channel === "email");
  if (existing) return;
  stack.communicationPreferenceRuntime.applyEvent({
    id: `evt_pref_opt_in_${partyId}`,
    timestampISO: nowISO,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "horizon_demo_bootstrap",
    payload: {
      preference: createCommunicationPreference({
        id: `pref_${partyId}_email`,
        partyId,
        workspaceId: stack.workspaceId,
        channel: "email",
        scope: "all",
        status: "opt_in",
        source: "horizon_demo_bootstrap",
        recordedAt: nowISO,
      }),
    },
  });
}

function ensureProspectRelationship({ stack, partyId, nowISO }) {
  const relId = `rel_PROSPECT_${partyId}`;
  if (stack.businessGraphRuntime.getRelationship(relId)) return;
  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_prospect_${partyId}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "horizon_demo_bootstrap",
    payload: {
      relationship: {
        id: relId,
        fromEntity: { entityType: ENTITY_TYPES.PARTY, entityId: partyId },
        toEntity: { entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" },
        relationshipType: "PROSPECT",
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

function sendAcknowledgmentSync({
  stack,
  integrationPlatform,
  partyId,
  requestId,
  workspaceId,
  nowISO,
  acknowledgmentIntentId,
}) {
  const intent = stack.installationResult?.communicationIntents?.find((i) => String(i.id) === String(acknowledgmentIntentId));
  if (!intent) return { status: "skipped", reason: "intent_not_configured" };

  const channel = String(intent.channel ?? "email");
  const connectionType = channel === "sms" ? "sms_channel" : "business_email";
  const preferenceCheck = checkCommunicationPermitted({
    preferenceRuntime: stack.communicationPreferenceRuntime,
    partyId,
    channel,
  });
  if (!preferenceCheck.permitted) {
    return { status: "blocked", reason: preferenceCheck.reason };
  }

  const connection = integrationPlatform.connectionRuntime
    .getConnections()
    .find((c) => c.connectionType === connectionType);
  if (!connection || connection.status !== CONNECTION_STATUSES.CONNECTED) {
    return { status: "blocked", reason: `connection_not_ready:${connection?.status ?? "missing"}` };
  }

  const threadId = `ct_ack_${requestId}`;
  const messageId = `cm_ack_${requestId}`;
  if (!stack.communicationRuntime.getMessage(messageId)) {
    new RecordCommunicationService().execute({
      communicationRuntime: stack.communicationRuntime,
      nowISO,
      threadId,
      subject: "Re: Unit 2B inquiry",
      channel,
      participants: [
        { id: "tm_leasing", type: "human" },
        { id: partyId, type: "external_system" },
      ],
      partyId,
      requestId,
      messages: [
        {
          id: messageId,
          direction: "outbound",
          channel,
          subject: "Re: Unit 2B inquiry",
          body: "Thank you for your interest in Unit 2B at Harbor View. We received your inquiry.",
          sender: { id: "tm_leasing", type: "human" },
          recipients: [{ id: partyId, type: "external_system" }],
          nowISO,
          draftedAtISO: nowISO,
          queuedAtISO: nowISO,
        },
      ],
    });
    stack.communicationRuntime.applyEvent({
      id: `evt_ack_sent_${messageId}`,
      timestampISO: nowISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_SENT,
      source: "horizon_demo_bootstrap",
      payload: { messageId },
    });
  }

  return { status: "sent", channel, messageId };
}

export function runWebsiteInquiryOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO }) {
  if (isHorizonPrimaryLoopComplete({ stack })) {
    return deepFreeze({
      skipped: true,
      partyId: getHorizonTaylorPartyId(),
      requestId: getHorizonTaylorRequestId(),
    });
  }

  const ingress = integrationPlatform.webhookIngressService;
  const ingest = ingress.ingest({
    providerId: "provider_mock_form",
    payload: buildWebsiteFormPayload({ nowISO }),
  });
  if (!ingest.accepted && !ingest.duplicate) {
    throw new Error(`horizon bootstrap: form ingest failed: ${ingest.reason}`);
  }

  const partyId = getHorizonTaylorPartyId();
  const requestId = getHorizonTaylorRequestId();
  recordPartyOptIn({ stack, partyId, nowISO });
  ensureProspectRelationship({ stack, partyId, nowISO });

  const routing = stack.installationResult?.inboundRouting?.find((r) => r.eventKind === "form_submission");
  const acknowledgment = sendAcknowledgmentSync({
    stack,
    integrationPlatform,
    partyId,
    requestId,
    workspaceId,
    nowISO,
    acknowledgmentIntentId: routing?.acknowledgmentIntentId,
  });

  const interactionId = `int_qual_${HORIZON_DEMO_FORM_SUBMISSION_ID}`;
  if (!stack.interactionRuntime.getInteraction(interactionId)) {
    new RecordInteractionService({ interactionPlatformEventPublisher: stack.osInteractionPublisher }).execute({
      interactionRuntime: stack.interactionRuntime,
      interactionInput: {
        id: interactionId,
        interactionType: "call",
        direction: "inbound",
        channel: "website",
        occurredAt: nowISO,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
          createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_horizon_unit_2b" }),
        ],
        ownerId: "tm_leasing",
        status: "active",
        summary: "Qualification conversation",
        metadata: {},
      },
      noteText: HORIZON_DEMO_EXACT_QUALIFICATION_NOTE,
      noteAuthorId: "tm_leasing",
      noteTimestampISO: nowISO,
      outcome: "showing_requested",
      nextStep: "showing_requested",
      followUpAt: "2026-07-05T14:00:00.000Z",
      nowISO,
      metadata: {},
    });
  }

  return deepFreeze({
    skipped: false,
    ingest,
    partyId,
    requestId,
    subjectId: "subj_horizon_unit_2b",
    interactionId,
    acknowledgment,
  });
}

export function runMissedCallOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO, verifySms = true }) {
  const ingress = integrationPlatform.webhookIngressService;
  const ingest = ingress.ingest({
    providerId: "provider_mock_voice",
    payload: buildMissedCallPayload({ nowISO }),
  });

  const partyId = getHorizonTaylorPartyId();
  let smsConnection = integrationPlatform.connectionRuntime
    .getConnections()
    .find((c) => c.connectionType === "sms_channel");

  if (verifySms && (!smsConnection || smsConnection.status !== CONNECTION_STATUSES.CONNECTED)) {
    smsConnection = verifyDemoConnectionSync({
      connectionService: integrationPlatform.connectionService,
      connectionRuntime: integrationPlatform.connectionRuntime,
      workspaceId,
      connectionType: "sms_channel",
      providerType: "provider_mock_sms",
      displayName: "SMS Channel",
      nowISO,
    });
  }

  return deepFreeze({
    ingest,
    partyId,
    partyCount: stack.businessGraphRuntime.getParties().length,
    smsConnectionStatus: smsConnection?.status ?? "missing",
    smsCapabilityReady: smsConnection?.status === CONNECTION_STATUSES.CONNECTED,
  });
}

export async function runMissedCallSmsSuccessProof({ stack, integrationPlatform, workspaceId, nowISO }) {
  const partyId = getHorizonTaylorPartyId();
  const smsConnection = verifyDemoConnectionSync({
    connectionService: integrationPlatform.connectionService,
    connectionRuntime: integrationPlatform.connectionRuntime,
    workspaceId,
    connectionType: "sms_channel",
    providerType: "provider_mock_sms",
    displayName: "SMS Channel",
    nowISO,
  });

  return integrationPlatform.actionOrchestrator.execute(
    createExternalActionRequest({
      id: `action_sms_ack_${HORIZON_DEMO_MISSED_CALL_ID}`,
      workspaceId,
      capability: INTEGRATION_CAPABILITIES.SEND_SMS,
      connectionId: smsConnection.id,
      parameters: { partyId },
      idempotencyKey: `sms_ack_${HORIZON_DEMO_MISSED_CALL_ID}`,
    }),
  );
}

/**
 * Synchronous canonical Horizon demo business-event bootstrap.
 */
export function bootstrapHorizonPropertiesDemo({ stack, integrationPlatform, workspaceId, nowISO }) {
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const wid = String(workspaceId ?? stack.workspaceId);

  if (isHorizonBootstrapMarked(wid) && isHorizonPrimaryLoopComplete({ stack })) {
    return deepFreeze({
      skipped: true,
      bootstrapVersion: HORIZON_DEMO_BOOTSTRAP_VERSION,
      primaryPartyId: getHorizonTaylorPartyId(),
      primaryRequestId: getHorizonTaylorRequestId(),
      partyIds: stack.businessGraphRuntime.getParties().map((p) => p.id),
    });
  }

  verifyDemoConnectionSync({
    connectionService: integrationPlatform.connectionService,
    connectionRuntime: integrationPlatform.connectionRuntime,
    workspaceId: wid,
    connectionType: "business_email",
    providerType: "provider_mock_email",
    displayName: "Business Email",
    nowISO: effectiveNowISO,
  });

  const primary = runWebsiteInquiryOnWorkspace({
    stack,
    integrationPlatform,
    workspaceId: wid,
    nowISO: effectiveNowISO,
  });
  const missedCall = runMissedCallOnWorkspace({
    stack,
    integrationPlatform,
    workspaceId: wid,
    nowISO: effectiveNowISO,
    verifySms: true,
  });
  const secondary = runHorizonSecondaryDemoScenarios({ stack, nowISO: effectiveNowISO });
  const businessDay = runHorizonDemoBusinessDayInputs({
    stack,
    integrationPlatform,
    workspaceId: wid,
    nowISO: effectiveNowISO,
  });

  markHorizonBootstrapComplete(wid);

  return deepFreeze({
    bootstrapVersion: HORIZON_DEMO_BOOTSTRAP_VERSION,
    primaryPartyId: primary.partyId ?? getHorizonTaylorPartyId(),
    primaryRequestId: primary.requestId ?? getHorizonTaylorRequestId(),
    subjectIds: ["subj_horizon_unit_2b"],
    partyIds: stack.businessGraphRuntime.getParties().map((p) => p.id),
    requestIds: stack.requestRuntime.getRequests().map((r) => r.id),
    primary,
    missedCall,
    secondary,
    businessDay,
    pendingApprovalRunId:
      stack.automationRuntime.getRuns().find((r) => r.status === "WAITING_FOR_APPROVAL")?.id ?? null,
  });
}
