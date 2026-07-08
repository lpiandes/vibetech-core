import { RecordCommunicationService } from "../../communications/use-cases/RecordCommunicationService.js";
import { checkCommunicationPermitted } from "../../communications/preferences/CommunicationPreferenceEnforcer.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Executes configured inbound acknowledgment when connection + preference allow.
 */
export class InboundAcknowledgmentService {
  constructor({
    installationResult,
    communicationRuntime,
    communicationActionService,
    connectionRuntime,
    preferenceRuntime,
    nowISO = "2026-07-01T00:00:00.000Z",
  } = {}) {
    this.installationResult = installationResult ?? null;
    this.communicationRuntime = communicationRuntime;
    this.communicationActionService = communicationActionService;
    this.connectionRuntime = connectionRuntime;
    this.preferenceRuntime = preferenceRuntime ?? null;
    this.nowISO = String(nowISO);
    this.recordCommunicationService = new RecordCommunicationService();
  }

  async execute({
    acknowledgmentIntentId,
    partyId,
    requestId,
    workspaceId,
    assigneeId = "tm_leasing",
    subjectLine = "Thank you for your inquiry",
    body = "We received your inquiry and will follow up shortly.",
  } = {}) {
    const intent = safeArray(this.installationResult?.communicationIntents).find(
      (i) => String(i.id) === String(acknowledgmentIntentId),
    );
    if (!intent) {
      return deepFreeze({ status: "skipped", reason: "intent_not_configured" });
    }

    const channel = String(intent.channel ?? "email");
    const capability =
      channel === "sms" ? INTEGRATION_CAPABILITIES.SEND_SMS : INTEGRATION_CAPABILITIES.SEND_EMAIL;
    const connectionType = channel === "sms" ? "sms_channel" : "business_email";

    const preferenceCheck = checkCommunicationPermitted({
      preferenceRuntime: this.preferenceRuntime,
      partyId,
      channel,
    });
    if (!preferenceCheck.permitted) {
      return deepFreeze({
        status: "blocked",
        reason: preferenceCheck.reason ?? "communication_not_permitted",
        channel,
      });
    }

    const connection = safeArray(this.connectionRuntime?.getConnections?.()).find(
      (c) => c.connectionType === connectionType,
    );
    if (!connection || ![CONNECTION_STATUSES.CONNECTED, CONNECTION_STATUSES.DEGRADED].includes(connection.status)) {
      return deepFreeze({
        status: "blocked",
        reason: `connection_not_ready:${connection?.status ?? "missing"}`,
        channel,
        connectionType,
      });
    }

    const threadId = `ct_ack_${requestId}`;
    const messageId = `cm_ack_${requestId}`;
    this.recordCommunicationService.execute({
      communicationRuntime: this.communicationRuntime,
      nowISO: this.nowISO,
      threadId,
      subject: subjectLine,
      channel,
      participants: [
        { id: assigneeId, type: "human" },
        { id: partyId, type: "external_system" },
      ],
      partyId,
      requestId,
      messages: [
        {
          id: messageId,
          direction: "outbound",
          channel,
          subject: subjectLine,
          body,
          sender: { id: assigneeId, type: "human" },
          recipients: [{ id: partyId, type: "external_system" }],
          nowISO: this.nowISO,
          draftedAtISO: this.nowISO,
          queuedAtISO: this.nowISO,
        },
      ],
    });

    if (!this.communicationActionService?.sendQueuedEmail && channel === "email") {
      return deepFreeze({ status: "recorded", reason: "no_action_service", channel, messageId });
    }

    if (channel === "email") {
      const result = await this.communicationActionService.sendQueuedEmail({
        workspaceId,
        connectionId: connection.id,
        messageId,
        requestedBy: assigneeId,
        source: "inbound_acknowledgment",
      });
      return deepFreeze({
        status: result.status === "COMPLETED" ? "sent" : "blocked",
        reason: result.error ?? null,
        channel,
        messageId,
        actionResult: result,
      });
    }

    return deepFreeze({
      status: "blocked",
      reason: "sms_capability_requires_send_path",
      channel,
      messageId,
    });
  }
}
