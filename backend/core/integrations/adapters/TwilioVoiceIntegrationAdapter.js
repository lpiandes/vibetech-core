import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function isTwilioVoiceConfigured() {
  return Boolean(
    safeString(process.env.TWILIO_ACCOUNT_SID)
    && safeString(process.env.TWILIO_AUTH_TOKEN)
    && safeString(process.env.TWILIO_VOICE_FROM || process.env.TWILIO_PHONE_NUMBER),
  );
}

/**
 * Twilio Voice adapter — outbound calls after owner approval.
 */
export class TwilioVoiceIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "twilio_voice";
  }

  get displayName() {
    return "Twilio Voice";
  }

  get supportedConnectionTypes() {
    return ["voice_channel"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL, INTEGRATION_CAPABILITIES.RECEIVE_VOICE_CALL];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect phone (Twilio Voice)",
      summary: "Place approved outbound calls through your Twilio number.",
      estimatedTime: "15 minutes",
      prerequisites: ["Twilio account", "Voice-capable phone number", "Webhook URL for call TwiML"],
      steps: ["Enter Twilio credentials", "Confirm From number", "Configure call webhook", "Verify"],
      permissionsRequested: ["place_voice_call"],
      verificationMethod: "Credential resolve + Twilio account probe.",
      commonProblems: ["Missing voice webhook URL", "From number not voice-capable"],
      reconnectInstructions: "Update Twilio voice credentials and reconnect.",
      documentationReference: "https://www.twilio.com/docs/voice",
    });
  }

  async healthCheck() {
    return { status: isTwilioVoiceConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) {
      throw new Error("Twilio Voice credentials required.");
    }
    const resolved = credentialResolver.resolve(connection.credentialReference);
    return {
      accountSid: safeString(resolved.accountSid || process.env.TWILIO_ACCOUNT_SID),
      authToken: safeString(resolved.authToken || process.env.TWILIO_AUTH_TOKEN),
      fromNumber: safeString(resolved.fromNumber || process.env.TWILIO_VOICE_FROM || process.env.TWILIO_PHONE_NUMBER),
      twimlUrl: safeString(resolved.twimlUrl || process.env.TWILIO_VOICE_TWIML_URL),
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
        message: "Twilio Voice connection verified.",
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
    const capability = String(actionRequest?.capability ?? "");
    if (capability !== INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const to = safeString(actionRequest?.parameters?.to || actionRequest?.parameters?.phone);
      const url = safeString(actionRequest?.parameters?.twimlUrl || creds.twimlUrl);
      if (!to || !url) {
        return deepFreeze({ status: "failed", error: "to_and_twiml_url_required", completedAt: this._nowISO });
      }
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
      const form = new URLSearchParams({ To: to, From: creds.fromNumber, Url: url });
      const res = await this._fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls.json`,
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
