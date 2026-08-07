import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { callMicrosoftGraph, isMicrosoftOAuthAppConfigured } from "../oauth/MicrosoftOAuthClient.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function extractEmail(participant) {
  if (!participant || typeof participant !== "object") return null;
  const md = participant.metadata ?? {};
  const email =
    (participant.email && safeString(participant.email))
    || (participant.address && safeString(participant.address))
    || (md.email && safeString(md.email))
    || null;
  const trimmed = email ? String(email).trim() : "";
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

/**
 * Outlook / Microsoft 365 mail adapter — sends business email via Microsoft Graph
 * (no MSAL/SDK dependency; plain fetch, mirroring the Twilio/Meta fetch-based adapters).
 */
export class OutlookMailIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "outlook";
  }

  get displayName() {
    return "Outlook";
  }

  get supportedConnectionTypes() {
    return ["business_email"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Outlook",
      summary: "Send business email through your Microsoft 365 or Outlook.com account.",
      estimatedTime: "5 minutes",
      prerequisites: ["Microsoft 365 or Outlook.com account", "Administrator consent for OAuth on managed tenants"],
      steps: ["Click Connect with Microsoft", "Sign in with Microsoft", "Authorize send permissions", "Verify connection"],
      permissionsRequested: ["Mail.Send", "User.Read", "offline_access"],
      verificationMethod: "OAuth token exchange and Microsoft Graph /me probe.",
      commonProblems: ["Tenant admin consent required for organizational accounts", "Refresh token missing — reconnect and approve consent"],
      reconnectInstructions: "Disconnect and Connect with Microsoft again.",
      documentationReference: "https://learn.microsoft.com/graph/api/user-sendmail",
    });
  }

  async healthCheck() {
    return { status: isMicrosoftOAuthAppConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) {
      throw new Error("Outlook credentials required.");
    }
    const resolved = credentialResolver.resolve(connection.credentialReference);
    const refreshToken = safeString(resolved.refreshToken || resolved.refresh_token);
    if (!refreshToken) throw new Error("Outlook refresh token missing.");
    return {
      refreshToken,
      accessToken: safeString(resolved.accessToken || resolved.access_token),
      senderEmail: safeString(
        resolved.senderEmail
        || resolved.metadata?.senderEmail
        || connection.credentialReference?.metadata?.senderEmail,
      ),
    };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Outlook credentials are required.",
      });
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const { res } = await callMicrosoftGraph({
        path: "/me",
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        fetchImpl: this._fetch,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "verification_failed",
          message: safeString(data?.error?.message) || `Microsoft Graph probe failed (${res.status}).`,
        });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "Outlook connection verified.",
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "verification_failed",
        message: String(err?.message ?? err),
      });
    }
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    if (actionRequest?.capability !== INTEGRATION_CAPABILITIES.SEND_EMAIL) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    const message = actionRequest.parameters?.message;
    if (!message) {
      return deepFreeze({ status: "failed", error: "message_required", completedAt: this._nowISO });
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const toEmails = (Array.isArray(message.recipients) ? message.recipients : [])
        .map((r) => extractEmail(r))
        .filter(Boolean);
      if (!toEmails.length) {
        return deepFreeze({ status: "failed", error: "recipient_required", completedAt: this._nowISO });
      }
      const subject = safeString(message.subject) || "(no subject)";
      const bodyText = safeString(message.body);
      if (!bodyText) {
        return deepFreeze({ status: "failed", error: "message_body required", completedAt: this._nowISO });
      }
      const fromEmail = extractEmail(message.sender) || creds.senderEmail || "";

      const draftPayload = {
        subject,
        body: { contentType: "Text", content: bodyText },
        toRecipients: toEmails.map((address) => ({ emailAddress: { address } })),
      };

      // Create a draft, then send it — /me/sendMail returns 202 with no body and no
      // message id to prove against; the draft+send path gives a real externalReference.
      const created = await callMicrosoftGraph({
        path: "/me/messages",
        method: "POST",
        body: draftPayload,
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        fetchImpl: this._fetch,
      });
      if (!created.res.ok) {
        const data = await created.res.json().catch(() => ({}));
        throw new Error(safeString(data?.error?.message) || `Graph draft create failed (${created.res.status}).`);
      }
      const draft = await created.res.json().catch(() => ({}));
      const messageId = safeString(draft?.id);
      if (!messageId) {
        throw new Error("Microsoft Graph did not return a message id for the draft.");
      }

      const sent = await callMicrosoftGraph({
        path: `/me/messages/${encodeURIComponent(messageId)}/send`,
        method: "POST",
        accessToken: created.accessToken,
        refreshToken: creds.refreshToken,
        fetchImpl: this._fetch,
      });
      if (!sent.res.ok) {
        const data = await sent.res.json().catch(() => ({}));
        throw new Error(safeString(data?.error?.message) || `Graph send failed (${sent.res.status}).`);
      }

      return deepFreeze({
        externalReference: messageId,
        status: "completed",
        completedAt: this._nowISO,
        metadata: deepFreeze({
          provider: this.id,
          senderEmail: fromEmail || null,
          to: toEmails,
        }),
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
