import {
  createExternalActionRequest,
  createExternalActionResult,
  EXTERNAL_ACTION_STATUSES,
} from "./ExternalActionRequest.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { CONNECTION_EVENT_TYPES } from "../connections/ConnectionEventTypes.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { providerSupportsCapability } from "../providers/IntegrationProviderValidator.js";
import { CommunicationExecutionService } from "../../communications/providers/CommunicationExecutionService.js";
import { checkCommunicationPermitted } from "../../communications/preferences/CommunicationPreferenceEnforcer.js";
import { evaluateOutboundSendPermission } from "../../approvals/OutboundApprovalGate.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`ExternalActionOrchestrationService: ${message}`);
}

export class ExternalActionOrchestrationService {
  constructor({
    connectionRuntime,
    providerRegistry,
    credentialResolver,
    communicationRuntime,
    communicationExecutionService,
    preferenceRuntime = null,
    integrationPlatformEventPublisher = null,
    communicationPlatformEventPublisher = null,
    nowISO = "2026-07-01T00:00:00.000Z",
  } = {}) {
    if (!connectionRuntime) fail("connectionRuntime required.");
    if (!providerRegistry) fail("providerRegistry required.");
    if (!credentialResolver) fail("credentialResolver required.");
    this.connectionRuntime = connectionRuntime;
    this.providerRegistry = providerRegistry;
    this.credentialResolver = credentialResolver;
    this.communicationRuntime = communicationRuntime ?? null;
    this.preferenceRuntime = preferenceRuntime ?? null;
    this.communicationExecutionService = communicationExecutionService ?? new CommunicationExecutionService();
    this.integrationPlatformEventPublisher = integrationPlatformEventPublisher;
    this.communicationPlatformEventPublisher = communicationPlatformEventPublisher;
    this.nowISO = String(nowISO);
    this._idempotency = new Map();
  }

  #publishActionEvent({ eventType, actionRequest, result } = {}) {
    if (!this.integrationPlatformEventPublisher?.publish) return;
    this.integrationPlatformEventPublisher.publish({
      eventType,
      aggregateId: String(actionRequest?.id ?? result?.actionRequestId ?? "external_action"),
      payload: deepFreeze({
        actionRequestId: actionRequest?.id ?? result?.actionRequestId,
        capability: actionRequest?.capability ?? null,
        connectionId: result?.connectionId ?? actionRequest?.connectionId ?? null,
        status: result?.status ?? null,
        providerId: result?.providerId ?? actionRequest?.providerId ?? null,
      }),
    });
  }

  #resolveConnection(actionRequest) {
    if (actionRequest.connectionId) {
      const conn = this.connectionRuntime.getConnection(actionRequest.connectionId);
      if (!conn) fail(`connection not found: ${actionRequest.connectionId}`);
      return conn;
    }
    const candidates = this.connectionRuntime
      .getConnections()
      .filter((c) => c.capabilities.includes(actionRequest.capability));
    const connected = candidates.find((c) => c.status === CONNECTION_STATUSES.CONNECTED);
    return connected ?? candidates[0] ?? null;
  }

  #resolveProvider(connection, actionRequest) {
    const providerId = actionRequest.providerId ?? connection?.providerType;
    if (!providerId) fail("provider could not be resolved.");
    const provider = this.providerRegistry.getProvider(providerId);
    if (!provider) fail(`provider not found: ${providerId}`);
    if (!providerSupportsCapability(provider, actionRequest.capability)) {
      fail(`provider does not support capability: ${actionRequest.capability}`);
    }
    return provider;
  }

  #resolveOutboundPartyId(actionRequest) {
    const fromParams = actionRequest.parameters?.partyId;
    if (fromParams) return String(fromParams);

    const messageId = actionRequest.parameters?.messageId;
    if (messageId && this.communicationRuntime?.getMessage) {
      const message = this.communicationRuntime.getMessage(messageId);
      const recipient = (message?.recipients ?? []).find((r) => String(r.type) === "external_system");
      if (recipient?.id) return String(recipient.id);
    }

    return null;
  }

  #enforceCommunicationPreference(actionRequest) {
    const capability = actionRequest.capability;
    if (
      capability !== INTEGRATION_CAPABILITIES.SEND_EMAIL &&
      capability !== INTEGRATION_CAPABILITIES.SEND_SMS
    ) {
      return { permitted: true, reason: null };
    }
    if (!this.preferenceRuntime) return { permitted: true, reason: null };

    const channel = capability === INTEGRATION_CAPABILITIES.SEND_EMAIL ? "email" : "sms";
    const partyId = this.#resolveOutboundPartyId(actionRequest);
    return checkCommunicationPermitted({
      preferenceRuntime: this.preferenceRuntime,
      partyId,
      channel,
    });
  }

  #resolveOutboundApproved(actionRequest) {
    if (
      actionRequest.outboundApproved
      || actionRequest.parameters?.outboundApproved
      || actionRequest.metadata?.outboundApproved
    ) {
      return true;
    }

    const messageId = actionRequest.parameters?.messageId;
    if (!messageId || !this.communicationRuntime?.getMessage) return false;

    const message = this.communicationRuntime.getMessage(messageId);
    if (!message) return false;

    // Align with CommunicationExecutionService: already-queued messages were staged for delivery.
    return Boolean(
      message.metadata?.outboundApproved
      || message.metadata?.approvalStatus === "approved"
      || String(message.status).toLowerCase() === "queued",
    );
  }

  async execute(actionInput = {}) {
    const actionRequest =
      actionInput.id && actionInput.capability
        ? deepFreeze(actionInput)
        : createExternalActionRequest(actionInput);

    const idemKey = String(actionRequest.idempotencyKey ?? actionRequest.id);
    if (this._idempotency.has(idemKey)) {
      return this._idempotency.get(idemKey);
    }

    this.#publishActionEvent({ eventType: "EXTERNAL_ACTION_REQUESTED", actionRequest });

    // Opt-out / preference blocks must win before outbound approval staging.
    const preferenceCheck = this.#enforceCommunicationPreference(actionRequest);
    if (!preferenceCheck.permitted) {
      const blocked = createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: EXTERNAL_ACTION_STATUSES.BLOCKED,
        connectionId: actionRequest.connectionId,
        providerId: actionRequest.providerId,
        error: preferenceCheck.reason ?? "communication_not_permitted",
        startedAt: this.nowISO,
        completedAt: this.nowISO,
        retryable: false,
      });
      this._idempotency.set(idemKey, blocked);
      return blocked;
    }

    const messageId = actionRequest.parameters?.messageId;
    const message = messageId && this.communicationRuntime?.getMessage
      ? this.communicationRuntime.getMessage(messageId)
      : null;

    const outboundGate = evaluateOutboundSendPermission({
      capability: actionRequest.capability,
      channel: message?.channel ?? null,
      direction: message?.direction ?? null,
      requiresApproval: actionRequest.requiresApproval,
      outboundApproved: this.#resolveOutboundApproved(actionRequest),
      messageStatus: message?.status ?? null,
    });

    if (outboundGate.forceApproval || (actionRequest.requiresApproval && !outboundGate.allowed)) {
      return createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: EXTERNAL_ACTION_STATUSES.PENDING_APPROVAL,
        connectionId: actionRequest.connectionId,
        providerId: actionRequest.providerId,
        startedAt: this.nowISO,
        error: outboundGate.reason ?? "approval_required",
      });
    }

    if (actionRequest.requiresApproval && !outboundGate.outbound) {
      return createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: EXTERNAL_ACTION_STATUSES.PENDING_APPROVAL,
        connectionId: actionRequest.connectionId,
        providerId: actionRequest.providerId,
        startedAt: this.nowISO,
      });
    }

    const connection = this.#resolveConnection(actionRequest);
    if (!connection) {
      const blocked = createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: EXTERNAL_ACTION_STATUSES.BLOCKED,
        error: "no_connection_for_capability",
        startedAt: this.nowISO,
        completedAt: this.nowISO,
        retryable: false,
      });
      this._idempotency.set(idemKey, blocked);
      return blocked;
    }

    if (![CONNECTION_STATUSES.CONNECTED, CONNECTION_STATUSES.DEGRADED].includes(connection.status)) {
      const blocked = createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: EXTERNAL_ACTION_STATUSES.BLOCKED,
        connectionId: connection.id,
        providerId: connection.providerType,
        error: `connection_not_ready:${connection.status}`,
        startedAt: this.nowISO,
        completedAt: this.nowISO,
        retryable: true,
      });
      this._idempotency.set(idemKey, blocked);
      return blocked;
    }

    const provider = this.#resolveProvider(connection, actionRequest);
    const startedAt = this.nowISO;

    if (
      actionRequest.capability === INTEGRATION_CAPABILITIES.SEND_EMAIL &&
      this.communicationRuntime &&
      actionRequest.parameters?.messageId &&
      provider.communicationProvider
    ) {
      const commResult = await this.communicationExecutionService.execute({
        communicationRuntime: this.communicationRuntime,
        provider: provider.communicationProvider,
        messageId: actionRequest.parameters.messageId,
        nowISO: this.nowISO,
      });
      const result = createExternalActionResult({
        actionRequestId: actionRequest.id,
        status: commResult.status === "success" ? EXTERNAL_ACTION_STATUSES.COMPLETED : EXTERNAL_ACTION_STATUSES.FAILED,
        providerId: provider.id,
        connectionId: connection.id,
        externalReference: commResult.providerMessageId,
        startedAt,
        completedAt: commResult.occurredAt,
        error: commResult.status === "success" ? null : "communication_send_failed",
        metadata: commResult.providerMetadata ?? {},
      });
      this.#recordActivity(connection.id, result);
      this.#publishActionEvent({
        eventType: result.status === EXTERNAL_ACTION_STATUSES.COMPLETED ? "EXTERNAL_ACTION_COMPLETED" : "EXTERNAL_ACTION_FAILED",
        actionRequest,
        result,
      });
      if (result.status === EXTERNAL_ACTION_STATUSES.COMPLETED) {
        const message = this.communicationRuntime?.getMessage?.(actionRequest.parameters.messageId) ?? null;
        if (message && this.communicationPlatformEventPublisher?.publishCommunicationSent) {
          this.communicationPlatformEventPublisher.publishCommunicationSent({
            message,
            occurredAt: commResult.sentAt ?? commResult.occurredAt,
            metadata: { derivedFrom: { actionRequestId: actionRequest.id } },
          });
        }
      }
      this._idempotency.set(idemKey, result);
      return result;
    }

    const providerResult = await provider.executeAction({
      actionRequest,
      connection,
      credentialResolver: this.credentialResolver,
    });

    const result = createExternalActionResult({
      actionRequestId: actionRequest.id,
      status: providerResult.status === "completed" ? EXTERNAL_ACTION_STATUSES.COMPLETED : EXTERNAL_ACTION_STATUSES.FAILED,
      providerId: provider.id,
      connectionId: connection.id,
      externalReference: providerResult.externalReference ?? null,
      startedAt,
      completedAt: providerResult.completedAt ?? this.nowISO,
      error: providerResult.error ?? null,
      retryable: Boolean(providerResult.retryable),
      metadata: providerResult.metadata ?? {},
    });

    this.#recordActivity(connection.id, result);
    this.#publishActionEvent({
      eventType: result.status === EXTERNAL_ACTION_STATUSES.COMPLETED ? "EXTERNAL_ACTION_COMPLETED" : "EXTERNAL_ACTION_FAILED",
      actionRequest,
      result,
    });
    this._idempotency.set(idemKey, result);
    return result;
  }

  #recordActivity(connectionId, result) {
    this.connectionRuntime.applyEvent({
      id: `evt_conn_activity_${result.actionRequestId}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_ACTIVITY_RECORDED,
      source: "external_action_orchestrator",
      payload: {
        connectionId,
        success: result.status === EXTERNAL_ACTION_STATUSES.COMPLETED,
        actionResult: result,
      },
    });
  }
}
