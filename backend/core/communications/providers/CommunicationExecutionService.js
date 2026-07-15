import { COMMUNICATION_EVENT_TYPES } from "../CommunicationEventTypes.js";

import { COMMUNICATION_PROVIDER_EXECUTION_SOURCE, PROVIDER_EXECUTION_STATUS } from "./CommunicationProviderDefaults.js";

import { validateCommunicationProvider, validateCommunicationProviderMessage, validateCommunicationProviderSendResult } from "./CommunicationProviderValidator.js";

import { createCommunicationExecutionResult } from "./CommunicationExecutionResult.js";
import { evaluateOutboundSendPermission, isOutboundChannel } from "../../approvals/OutboundApprovalGate.js";

function fail(message) {
  throw new Error(`CommunicationExecutionService: ${message}`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function generateExecutionId({ providerId, messageId, nowISO }) {
  const safe = `${safeString(providerId)}_${safeString(messageId)}_${safeString(nowISO)}`.replace(/[^a-zA-Z0-9]/g, "");
  return `exec_${safe}`;
}

export class CommunicationExecutionService {
  async execute({ communicationRuntime, provider, messageId, nowISO } = {}) {
    if (!communicationRuntime) fail("communicationRuntime required.");
    if (!provider) fail("provider required.");
    if (!messageId) fail("messageId required.");

    validateCommunicationProvider(provider);

    const message = communicationRuntime.getMessage?.(messageId);
    if (!message) fail(`message not found: ${safeString(messageId)}`);

    validateCommunicationProviderMessage(provider, message);

    const effectiveNowISO = safeString(nowISO ?? "2026-07-01T00:00:00.000Z");
    const executionId = generateExecutionId({ providerId: provider.id, messageId: message.id, nowISO: effectiveNowISO });

    const outboundGate = evaluateOutboundSendPermission({
      channel: message.channel,
      direction: message.direction,
      outboundApproved: Boolean(
        message.metadata?.outboundApproved
        || message.metadata?.approvalStatus === "approved"
        || String(message.status).toLowerCase() === "queued",
      ),
      messageStatus: message.status,
    });
    if (
      (String(message.direction).toLowerCase() === "outbound" || isOutboundChannel(message.channel))
      && !outboundGate.allowed
    ) {
      fail(outboundGate.reason ?? "outbound_approval_required");
    }

    let sendResult;
    try {
      sendResult = await provider.send(message);
      validateCommunicationProviderSendResult(sendResult);
    } catch (err) {
      const failedAt = effectiveNowISO;
      communicationRuntime.applyEvent({
        id: `evt_comm_exec_fail_${executionId}`,
        timestampISO: effectiveNowISO,
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
        source: COMMUNICATION_PROVIDER_EXECUTION_SOURCE,
        payload: { messageId: message.id },
      });

      return createCommunicationExecutionResult({
        executionId,
        communicationMessageId: message.id,
        providerId: safeString(provider.id),
        providerMessageId: `prov_failed_${executionId}`,
        status: PROVIDER_EXECUTION_STATUS.failed,
        sentAt: null,
        providerMetadata: {
          error: safeString(err?.message ?? err),
        },
        occurredAt: failedAt,
      });
    }

    const normalizedStatus = safeString(sendResult?.status).toLowerCase();
    const isSuccess = normalizedStatus === "sent" || normalizedStatus === "delivered";

    if (isSuccess) {
      communicationRuntime.applyEvent({
        id: `evt_comm_exec_sent_${executionId}`,
        timestampISO: effectiveNowISO,
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_SENT,
        source: COMMUNICATION_PROVIDER_EXECUTION_SOURCE,
        payload: { messageId: message.id },
      });

      return createCommunicationExecutionResult({
        executionId,
        communicationMessageId: message.id,
        providerId: safeString(provider.id),
        providerMessageId: safeString(sendResult.providerMessageId),
        status: PROVIDER_EXECUTION_STATUS.success,
        sentAt: sendResult.sentAt ?? effectiveNowISO,
        providerMetadata: sendResult.metadata ?? {},
        occurredAt: effectiveNowISO,
      });
    }

    communicationRuntime.applyEvent({
      id: `evt_comm_exec_failed_${executionId}`,
      timestampISO: effectiveNowISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
      source: COMMUNICATION_PROVIDER_EXECUTION_SOURCE,
      payload: { messageId: message.id },
    });

    return createCommunicationExecutionResult({
      executionId,
      communicationMessageId: message.id,
      providerId: safeString(provider.id),
      providerMessageId: safeString(sendResult.providerMessageId),
      status: PROVIDER_EXECUTION_STATUS.failed,
      sentAt: null,
      providerMetadata: sendResult.metadata ?? {},
      occurredAt: effectiveNowISO,
    });
  }
}

