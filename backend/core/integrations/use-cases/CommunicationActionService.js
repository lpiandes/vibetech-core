import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createExternalActionRequest } from "../actions/ExternalActionRequest.js";
import { ExternalActionOrchestrationService } from "../actions/ExternalActionOrchestrationService.js";

export class CommunicationActionService {
  constructor({ actionOrchestrator, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    this.actionOrchestrator =
      actionOrchestrator ??
      new ExternalActionOrchestrationService({
        connectionRuntime: null,
        providerRegistry: null,
        credentialResolver: null,
      });
    this.nowISO = String(nowISO);
  }

  async sendQueuedEmail({ workspaceId, connectionId, messageId, requestedBy, source = "communication_os" } = {}) {
    const actionRequest = createExternalActionRequest({
      id: `action_send_email_${messageId}`,
      workspaceId,
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId,
      requestedBy,
      source,
      sourceReference: messageId,
      parameters: { messageId },
      requestedAt: this.nowISO,
      idempotencyKey: `send_email_${messageId}`,
    });
    return this.actionOrchestrator.execute(actionRequest);
  }
}
