import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function isTwilioSmsConfigured() {
  return Boolean(
    safeString(process.env.TWILIO_ACCOUNT_SID)
    && safeString(process.env.TWILIO_AUTH_TOKEN)
    && safeString(process.env.TWILIO_MESSAGING_FROM || process.env.TWILIO_PHONE_NUMBER),
  );
}

/**
 * Twilio SMS adapter — REST API via fetch (no twilio SDK dependency).
 */
export class TwilioSmsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "twilio_sms";
  }

  get displayName() {
    return "Twilio SMS";
  }

  get supportedConnectionTypes() {
    return ["sms_channel"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_SMS];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Twilio SMS",
      summary: "Send approved text messages through your Twilio number.",
      estimatedTime: "10 minutes",
      prerequisites: ["Twilio account", "Messaging-capable phone number"],
      steps: ["Enter Account SID and Auth Token", "Confirm From number", "Verify with a test send"],
      permissionsRequested: ["send_sms"],
      verificationMethod: "Credential resolve + Twilio account probe.",
      commonProblems: ["Invalid auth token", "From number not SMS-capable"],
      reconnectInstructions: "Update Twilio credentials and reconnect.",
      documentationReference: "https://www.twilio.com/docs/sms",
    });
  }

  async healthCheck() {
    return { status: isTwilioSmsConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) {
      throw new Error("Twilio SMS credentials required.");
    }
    const resolved = credentialResolver.resolve(connection.credentialReference);
    return {
      accountSid: safeString(resolved.accountSid || process.env.TWILIO_ACCOUNT_SID),
      authToken: safeString(resolved.authToken || process.env.TWILIO_AUTH_TOKEN),
      fromNumber: safeString(resolved.fromNumber || process.env.TWILIO_MESSAGING_FROM || process.env.TWILIO_PHONE_NUMBER),
    };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    try {
      const creds = this.#creds({ connection, credentialResolver });
      if (!creds.accountSid || !creds.authToken || !creds.fromNumber) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "not_configured",
          message: "Twilio Account SID, Auth Token, and From number are required.",
        });
      }
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
      const res = await this._fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "verification_failed",
          message: `Twilio account probe failed (${res.status}).`,
        });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "Twilio SMS connection verified.",
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
    if (actionRequest?.capability !== INTEGRATION_CAPABILITIES.SEND_SMS) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const to = safeString(actionRequest?.parameters?.to || actionRequest?.parameters?.phone);
      const body = safeString(actionRequest?.parameters?.body || actionRequest?.parameters?.message);
      if (!to || !body) {
        return deepFreeze({ status: "failed", error: "to_and_body_required", completedAt: this._nowISO });
      }
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
      const form = new URLSearchParams({ To: to, From: creds.fromNumber, Body: body });
      const res = await this._fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return deepFreeze({
          status: "failed",
          error: safeString(data?.message || `twilio_http_${res.status}`),
          retryable: res.status >= 500,
          completedAt: this._nowISO,
        });
      }
      return deepFreeze({
        externalReference: safeString(data.sid),
        status: "completed",
        completedAt: this._nowISO,
        metadata: deepFreeze({ provider: this.id, to, from: creds.fromNumber }),
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        error: String(err?.message ?? err),
        retryable: true,
        completedAt: this._nowISO,
      });
    }
  }
}
