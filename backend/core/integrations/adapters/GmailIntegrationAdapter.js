import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { GmailCommunicationProvider } from "../../communications/providers/gmail/GmailCommunicationProvider.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isGmailConfigured } from "../../communications/providers/gmail/GmailProviderValidator.js";

/**
 * Gmail integration adapter — bridges universal IntegrationProvider to CommunicationProvider.
 */
export class GmailIntegrationAdapter extends IntegrationProvider {
  constructor({ gmailCommunicationProvider, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._communicationProvider = gmailCommunicationProvider ?? new GmailCommunicationProvider({ nowISO });
    this._nowISO = String(nowISO);
  }

  get id() {
    return "gmail";
  }

  get displayName() {
    return "Gmail";
  }

  get supportedConnectionTypes() {
    return ["business_email"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL];
  }

  get communicationProvider() {
    return this._communicationProvider;
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Gmail",
      summary: "Send business email through your Gmail account.",
      estimatedTime: "5 minutes",
      prerequisites: ["Google Workspace or Gmail account", "Administrator consent for OAuth"],
      steps: ["Click Connect", "Sign in with Google", "Authorize send permissions", "Verify test delivery"],
      permissionsRequested: ["send_email", "read_email_metadata"],
      verificationMethod: "Send a test email and confirm delivery in Communications OS.",
      commonProblems: ["OAuth consent screen not configured", "Refresh token missing"],
      reconnectInstructions: "Reconnect Gmail and re-authorize scopes.",
      documentationReference: "https://developers.google.com/gmail/api",
    });
  }

  async healthCheck() {
    return { status: this._communicationProvider.health, providerId: this.id };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    void credentialResolver;
    if (!connection?.credentialReference && !isGmailConfigured()) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "not_configured",
        message: "Gmail credentials are not configured.",
      });
    }
    const health = await this.healthCheck();
    if (health.status !== "healthy") {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "unhealthy",
        message: "Gmail provider is not healthy.",
      });
    }
    return deepFreeze({
      status: "success",
      verifiedAt: this._nowISO,
      capabilitiesVerified: this.supportedCapabilities,
      code: "verified",
      message: "Gmail connection verified.",
    });
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    void connection;
    void credentialResolver;
    if (actionRequest.capability !== INTEGRATION_CAPABILITIES.SEND_EMAIL) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    const message = actionRequest.parameters?.message;
    if (!message) {
      return deepFreeze({ status: "failed", error: "message_required", completedAt: this._nowISO });
    }
    try {
      const sendResult = await this._communicationProvider.send({ message });
      return deepFreeze({
        externalReference: String(sendResult.providerMessageId ?? ""),
        status: "completed",
        completedAt: sendResult.sentAt ?? this._nowISO,
        metadata: sendResult.metadata ?? {},
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        error: String(err?.message ?? err),
        retryable: false,
        completedAt: this._nowISO,
      });
    }
  }
}
