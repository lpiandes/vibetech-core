import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export class MockSmsIntegrationProvider extends IntegrationProvider {
  constructor({ shouldFail = false, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._shouldFail = Boolean(shouldFail);
    this._nowISO = String(nowISO);
    this._processedKeys = new Set();
  }

  get id() {
    return "provider_mock_sms";
  }

  get displayName() {
    return "Mock SMS Provider";
  }

  get supportedConnectionTypes() {
    return ["sms_channel"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_SMS];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Mock SMS",
      summary: "Development provider for deterministic SMS action proof.",
      estimatedTime: "3 minutes",
      prerequisites: ["SMS-enabled workspace"],
      steps: ["Select Mock SMS Provider", "Verify sender number", "Run verification"],
      permissionsRequested: ["send_sms"],
      verificationMethod: "Execute SEND_SMS through action orchestrator.",
      commonProblems: ["Sender number not configured."],
      reconnectInstructions: "Reconnect provider from Connection Center.",
    });
  }

  async verifyConnection({ connection } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Credential reference required.",
      });
    }
    return deepFreeze({
      status: "success",
      verifiedAt: this._nowISO,
      capabilitiesVerified: this.supportedCapabilities,
      code: "verified",
      message: "Mock SMS connection verified.",
    });
  }

  async executeAction({ actionRequest } = {}) {
    const key = String(actionRequest?.idempotencyKey ?? actionRequest?.id ?? "");
    if (this._processedKeys.has(key)) {
      return deepFreeze({ externalReference: `mock_sms_dup_${key}`, status: "completed", completedAt: this._nowISO });
    }
    if (this._shouldFail) {
      return deepFreeze({ status: "failed", error: "mock_sms_failed", retryable: true, completedAt: this._nowISO });
    }
    this._processedKeys.add(key);
    return deepFreeze({
      externalReference: `mock_sms_${actionRequest.id}`,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({ provider: this.id, channel: "sms" }),
    });
  }
}
