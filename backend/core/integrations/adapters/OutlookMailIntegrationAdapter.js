/**
 * Outlook / Microsoft 365 mail adapter via Microsoft Graph.
 */
import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isMicrosoftOAuthConfigured, refreshMicrosoftAccessToken } from "../oauth/MicrosoftOAuthClient.js";

export class OutlookMailIntegrationAdapter extends IntegrationProvider {
  constructor({ nowISO = new Date().toISOString(), fetchImpl = fetch } = {}) {
    super();
    this._nowISO = String(nowISO);
    this._fetch = fetchImpl;
  }

  get id() { return "outlook_mail"; }
  get displayName() { return "Outlook Mail"; }
  get supportedConnectionTypes() { return ["business_email", "outlook_mail"]; }
  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Outlook",
      summary: "Send business email through Microsoft 365 / Outlook.",
      estimatedTime: "5 minutes",
      prerequisites: ["Microsoft 365 account", "Admin consent if required"],
      steps: ["Click Connect with Microsoft", "Sign in", "Authorize Mail.Send", "Verify connection"],
      permissionsRequested: ["Mail.Send", "User.Read", "offline_access"],
      verificationMethod: "OAuth token exchange and Graph sendMail.",
      commonProblems: ["Tenant admin consent required", "Missing MICROSOFT_CLIENT_ID/SECRET"],
      reconnectInstructions: "Disconnect and Connect with Microsoft again.",
      documentationReference: "https://learn.microsoft.com/graph/api/user-sendmail",
    });
  }

  async healthCheck() {
    return {
      status: isMicrosoftOAuthConfigured() ? "ready" : "not_configured",
      providerId: this.id,
    };
  }

  async resolveAccessToken({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) return null;
    const resolved = credentialResolver.resolve(connection.credentialReference);
    let accessToken = resolved.accessToken || resolved.access_token || null;
    const refreshToken = resolved.refreshToken || resolved.refresh_token || null;
    if (!accessToken && refreshToken) {
      const refreshed = await refreshMicrosoftAccessToken({ refreshToken, fetchImpl: this._fetch });
      if (refreshed.ok) accessToken = refreshed.accessToken;
    }
    return accessToken ? String(accessToken) : null;
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    const capability = actionRequest?.capability;
    if (capability !== INTEGRATION_CAPABILITIES.SEND_EMAIL) {
      return deepFreeze({ status: "failed", error: "unsupported_capability" });
    }
    const accessToken = await this.resolveAccessToken({ connection, credentialResolver });
    if (!accessToken) {
      return deepFreeze({ status: "failed", error: "outlook_token_missing" });
    }
    const message = actionRequest?.parameters?.message ?? {};
    const to = (message.recipients ?? [])
      .map((r) => r?.metadata?.email || r?.email)
      .filter(Boolean);
    if (!to.length) {
      return deepFreeze({ status: "failed", error: "recipient_required" });
    }
    const res = await this._fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: String(message.subject ?? "VIBETech message"),
          body: {
            contentType: "Text",
            content: String(message.body ?? message.bodyText ?? ""),
          },
          toRecipients: to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return deepFreeze({
        status: "failed",
        error: `outlook_send_failed_${res.status}`,
        detail: detail.slice(0, 400),
      });
    }
    const externalReference = `outlook_mail_${Date.now()}`;
    return deepFreeze({
      status: "completed",
      externalReference,
      metadata: { provider: "outlook_mail", to },
    });
  }
}
