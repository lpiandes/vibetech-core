import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { GmailCommunicationProvider } from "../../communications/providers/gmail/GmailCommunicationProvider.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isGmailConfigured } from "../../communications/providers/gmail/GmailProviderValidator.js";
import { isGoogleOAuthAppConfigured } from "../oauth/GoogleOAuthClient.js";

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
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL, INTEGRATION_CAPABILITIES.RECEIVE_EMAIL];
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
      steps: ["Click Connect with Google", "Sign in with Google", "Authorize send permissions", "Verify connection"],
      permissionsRequested: ["send_email", "gmail.readonly", "userinfo.email"],
      verificationMethod: "OAuth token exchange and provider health check.",
      commonProblems: ["OAuth consent screen not configured", "Refresh token missing — re-consent with prompt=consent"],
      reconnectInstructions: "Disconnect and Connect with Google again.",
      documentationReference: "https://developers.google.com/gmail/api",
    });
  }

  async healthCheck() {
    return { status: this._communicationProvider.health, providerId: this.id };
  }

  #providerForConnection({ connection, credentialResolver } = {}) {
    return this.resolveProvider({ connection, credentialResolver });
  }

  /**
   * Resolve a GmailCommunicationProvider carrying the per-business vault credentials
   * for `connection`, falling back to the env-configured/injected default provider.
   * Public so callers outside executeAction (e.g. GmailInboundSyncService) can reuse
   * the same credential-resolution rules for read APIs.
   */
  resolveProvider({ connection, credentialResolver } = {}) {
    if (!connection?.credentialReference || !credentialResolver) {
      return this._communicationProvider;
    }
    try {
      const resolved = credentialResolver.resolve(connection.credentialReference);
      const refreshToken = resolved.refreshToken || resolved.refresh_token;
      const senderEmail = resolved.senderEmail || resolved.metadata?.senderEmail || connection.credentialReference?.metadata?.senderEmail;
      if (refreshToken) {
        return this._communicationProvider.withCredentials({
          refreshToken,
          accessToken: resolved.accessToken || resolved.access_token || null,
          senderEmail: senderEmail || null,
        });
      }
    } catch {
      // Fall through to default provider (env-configured or injected test double).
    }
    return this._communicationProvider;
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    const hasVaultCreds = Boolean(connection?.credentialReference?.credentialId);
    if (!hasVaultCreds && !isGmailConfigured() && !isGoogleOAuthAppConfigured()) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "not_configured",
        message: "Gmail credentials are not configured.",
      });
    }

    const provider = this.#providerForConnection({ connection, credentialResolver });
    const health = provider.health;
    if (health !== "healthy" && !connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "unhealthy",
        message: "Gmail provider is not healthy.",
      });
    }

    // Vault-backed connections are verified when credentials resolve.
    if (hasVaultCreds && credentialResolver) {
      try {
        credentialResolver.resolve(connection.credentialReference);
      } catch (err) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "credential_resolve_failed",
          message: String(err?.message ?? err),
        });
      }
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
    if (actionRequest.capability === INTEGRATION_CAPABILITIES.RECEIVE_EMAIL) {
      try {
        const provider = this.#providerForConnection({ connection, credentialResolver });
        const { query, maxResults, pageToken } = actionRequest.parameters ?? {};
        const inbox = await provider.listInbox({ query, maxResults, pageToken });
        return deepFreeze({
          status: "completed",
          completedAt: this._nowISO,
          metadata: { messages: inbox.messages, nextPageToken: inbox.nextPageToken ?? null },
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

    if (actionRequest.capability !== INTEGRATION_CAPABILITIES.SEND_EMAIL) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    const message = actionRequest.parameters?.message;
    if (!message) {
      return deepFreeze({ status: "failed", error: "message_required", completedAt: this._nowISO });
    }
    try {
      const provider = this.#providerForConnection({ connection, credentialResolver });
      const sendResult = await provider.send(message);
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
