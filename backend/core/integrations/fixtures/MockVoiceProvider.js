import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export class MockVoiceProvider extends IntegrationProvider {
  constructor({ nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._nowISO = String(nowISO);
  }

  get id() {
    return "provider_mock_voice";
  }

  get displayName() {
    return "Mock Voice Provider";
  }

  get supportedConnectionTypes() {
    return ["voice_channel"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.RECEIVE_VOICE_CALL, INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Voice Channel",
      summary: "Receive call events including missed calls.",
      estimatedTime: "15 minutes",
      prerequisites: ["Telephony account"],
      steps: ["Configure webhook", "Place test call"],
      permissionsRequested: [],
      verificationMethod: "Trigger a test missed call event.",
      commonProblems: ["Webhook not reachable."],
      reconnectInstructions: "Reconfigure telephony webhook.",
    });
  }

  validateWebhook({ payload } = {}) {
    if (!payload?.callId) return { valid: false, reason: "missing_call_id" };
    return { valid: true };
  }

  normalizeInboundEvent({ payload } = {}) {
    const externalEventId = String(payload.callId);
    return deepFreeze({
      externalEventId,
      eventType: payload.disposition ?? "missed_call",
      occurredAt: payload.occurredAt ?? this._nowISO,
      channel: "phone",
      normalizedFacts: deepFreeze({
        eventKind: "missed_call",
        identityHints: {
          phone: payload.from ?? payload.callerNumber ?? "",
          name: payload.callerName ?? "",
        },
        attribution: {
          sourceLabel: "phone",
        },
        title: "Missed call",
        message: payload.voicemailText ?? "",
      }),
    });
  }
}
