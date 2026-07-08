import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Deterministic mock email provider for tests and development only.
 */
export class MockEmailIntegrationProvider extends IntegrationProvider {
  constructor({ shouldFail = false, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._shouldFail = Boolean(shouldFail);
    this._nowISO = String(nowISO);
    this._processedKeys = new Set();
  }

  get id() {
    return "provider_mock_email";
  }

  get displayName() {
    return "Mock Email Provider";
  }

  get supportedConnectionTypes() {
    return ["business_email"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Mock Email",
      summary: "Development provider for deterministic email action proof.",
      estimatedTime: "2 minutes",
      prerequisites: ["Workspace administrator access"],
      steps: ["Select Mock Email Provider", "Save configuration", "Verify connection"],
      permissionsRequested: ["send_email"],
      verificationMethod: "Send a test action through the action orchestrator.",
      commonProblems: ["Connection not verified before sending."],
      reconnectInstructions: "Disconnect and reconnect through Connection Center.",
    });
  }

  async healthCheck() {
    return { status: "healthy", providerId: this.id };
  }

  async verifyConnection({ connection } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Credential reference required before verification.",
      });
    }
    return deepFreeze({
      status: "success",
      verifiedAt: this._nowISO,
      capabilitiesVerified: this.supportedCapabilities,
      code: "verified",
      message: "Mock email connection verified.",
    });
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    const key = String(actionRequest?.idempotencyKey ?? actionRequest?.id ?? "");
    if (this._processedKeys.has(key)) {
      return deepFreeze({
        externalReference: `mock_email_dup_${key}`,
        status: "completed",
        completedAt: this._nowISO,
        metadata: deepFreeze({ idempotent: true }),
      });
    }
    if (this._shouldFail) {
      return deepFreeze({
        externalReference: null,
        status: "failed",
        completedAt: this._nowISO,
        error: "mock_email_send_failed",
        retryable: true,
      });
    }
    void credentialResolver;
    void connection;
    this._processedKeys.add(key);
    return deepFreeze({
      externalReference: `mock_email_${actionRequest.id}`,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({ provider: this.id, channel: "email" }),
    });
  }
}
