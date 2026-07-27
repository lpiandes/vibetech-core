import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

/** Owner-facing copy for common Twilio SMS failure codes. */
export function humanizeTwilioSmsError({ errorCode, errorMessage, status } = {}) {
  const code = safeString(errorCode).replace(/\D/g, "");
  const msg = safeString(errorMessage).trim();
  const st = safeString(status).toLowerCase();

  if (code === "30034" || /unregistered number|a2p|10dlc/i.test(msg)) {
    return "Twilio blocked the text: your From number isn’t registered for US A2P / 10DLC yet. In Twilio Console, finish Brand + Campaign registration and add this number to that Messaging Service — or use a Toll-Free Twilio number for testing.";
  }
  if (code === "21608" || /unverified|trial/i.test(msg)) {
    return "Twilio trial can only text Verified Caller IDs. In Twilio Console → Phone Numbers → Verified Caller IDs, add your phone, then retry.";
  }
  if (code === "21211" || /invalid.*to/i.test(msg)) {
    return "That destination phone number looks invalid. Use country code, e.g. +15551234567.";
  }
  if (code === "21606" || /not a valid.*from/i.test(msg)) {
    return "The Twilio From number isn’t SMS-capable or doesn’t belong to this account. Check the From number in Twilio Console.";
  }
  if (st === "undelivered" || st === "failed") {
    return msg || `Twilio could not deliver the text (${st}${code ? `, code ${code}` : ""}).`;
  }
  if (msg) return msg;
  if (code) return `Twilio error ${code}. Check the message log in Twilio Console for details.`;
  return "";
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
      title: "Set up text messaging",
      summary: "VIBETech provisions a Twilio number from your business details.",
      estimatedTime: "5 minutes (carrier registration may take days)",
      prerequisites: ["Legal business name and address"],
      steps: [
        "Enter business details in VIBETech",
        "We buy and attach a Twilio number",
        "Carrier A2P registration runs in the background",
        "Prove with a test text when ready",
      ],
      permissionsRequested: ["send_sms"],
      verificationMethod: "Credential resolve + Twilio account probe.",
      commonProblems: ["Carrier A2P still pending", "Area code unavailable"],
      reconnectInstructions: "Re-run texting setup or paste advanced Twilio credentials.",
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
        const human = humanizeTwilioSmsError({
          errorCode: data?.code ?? data?.error_code,
          errorMessage: data?.message ?? data?.error_message,
        });
        return deepFreeze({
          status: "failed",
          error: human || safeString(data?.message || `twilio_http_${res.status}`),
          errorCode: safeString(data?.code ?? data?.error_code),
          retryable: res.status >= 500,
          completedAt: this._nowISO,
        });
      }
      return deepFreeze({
        externalReference: safeString(data.sid),
        status: "completed",
        completedAt: this._nowISO,
        metadata: deepFreeze({
          provider: this.id,
          to,
          from: creds.fromNumber,
          twilioStatus: safeString(data.status),
        }),
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

  /**
   * Poll Twilio message resource until delivered/sent or failed/undelivered.
   * Queued acceptance alone is not enough for design-partner prove honesty.
   */
  async checkMessageStatus({
    connection,
    credentialResolver,
    messageSid,
    attempts = 6,
    delayMs = 700,
  } = {}) {
    const sid = safeString(messageSid);
    if (!sid) {
      return { ok: false, reason: "missing_sid", message: "Twilio did not return a message SID." };
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
      let lastStatus = "unknown";
      let lastError = "";
      for (let i = 0; i < attempts; i += 1) {
        if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
        const res = await this._fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages/${sid}.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            reason: "status_probe_failed",
            message: safeString(data?.message || `Could not check Twilio message (${res.status}).`),
            status: lastStatus,
          };
        }
        lastStatus = safeString(data.status).toLowerCase();
        const errorCode = data.error_code ?? data.code;
        const errorMessage = data.error_message ?? data.message;
        lastError = humanizeTwilioSmsError({
          errorCode,
          errorMessage,
          status: lastStatus,
        }) || safeString(errorMessage || errorCode);
        if (lastStatus === "delivered" || lastStatus === "sent") {
          return { ok: true, status: lastStatus, sid };
        }
        if (lastStatus === "failed" || lastStatus === "undelivered" || lastStatus === "canceled") {
          return {
            ok: false,
            reason: "sms_not_delivered",
            status: lastStatus,
            errorCode: safeString(errorCode),
            message: lastError
              || `Twilio status: ${lastStatus}. Trial accounts can only text Verified Caller IDs; US long-code texts need A2P/10DLC.`,
          };
        }
        // queued / accepted / sending — keep polling
      }
      // Still queued after polls — do not mark proven (carrier may still drop it).
      return {
        ok: false,
        reason: "sms_not_confirmed",
        status: lastStatus,
        message: lastError
          || `Twilio still reports “${lastStatus}” — text not confirmed delivered. For US long codes you usually need A2P/10DLC; for trial, verify your phone under Verified Caller IDs.`,
      };
    } catch (err) {
      return {
        ok: false,
        reason: "status_probe_error",
        message: String(err?.message ?? err),
      };
    }
  }
}
