/**
 * Outlook / Microsoft 365 calendar adapter via Microsoft Graph.
 */
import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isMicrosoftOAuthConfigured, refreshMicrosoftAccessToken } from "../oauth/MicrosoftOAuthClient.js";

export class OutlookCalendarIntegrationAdapter extends IntegrationProvider {
  constructor({ nowISO = new Date().toISOString(), fetchImpl = fetch } = {}) {
    super();
    this._nowISO = String(nowISO);
    this._fetch = fetchImpl;
  }

  get id() { return "outlook_calendar"; }
  get displayName() { return "Outlook Calendar"; }
  get supportedConnectionTypes() { return ["calendar", "outlook_calendar"]; }
  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Outlook Calendar",
      summary: "Create calendar events through Microsoft 365 / Outlook.",
      estimatedTime: "5 minutes",
      prerequisites: ["Microsoft 365 account"],
      steps: ["Click Connect with Microsoft", "Authorize Calendars.ReadWrite", "Verify connection"],
      permissionsRequested: ["Calendars.ReadWrite", "User.Read", "offline_access"],
      verificationMethod: "OAuth token exchange and Graph create event.",
      commonProblems: ["Tenant admin consent required"],
      reconnectInstructions: "Disconnect and Connect with Microsoft again.",
      documentationReference: "https://learn.microsoft.com/graph/api/user-post-events",
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
    if (actionRequest?.capability !== INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT) {
      return deepFreeze({ status: "failed", error: "unsupported_capability" });
    }
    const accessToken = await this.resolveAccessToken({ connection, credentialResolver });
    if (!accessToken) {
      return deepFreeze({ status: "failed", error: "outlook_token_missing" });
    }
    const params = actionRequest?.parameters ?? {};
    const res = await this._fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: String(params.summary ?? params.subject ?? "VIBETech event"),
        body: {
          contentType: "Text",
          content: String(params.description ?? ""),
        },
        start: {
          dateTime: String(params.start?.dateTime ?? params.startISO ?? this._nowISO).replace(/Z$/, ""),
          timeZone: "UTC",
        },
        end: {
          dateTime: String(params.end?.dateTime ?? params.endISO ?? this._nowISO).replace(/Z$/, ""),
          timeZone: "UTC",
        },
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.id) {
      return deepFreeze({
        status: "failed",
        error: `outlook_event_failed_${res.status}`,
        detail: payload,
      });
    }
    return deepFreeze({
      status: "completed",
      externalReference: String(payload.id),
      metadata: { provider: "outlook_calendar", webLink: payload.webLink ?? null },
    });
  }
}
