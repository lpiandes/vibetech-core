import { google } from "googleapis";

import { CommunicationProvider } from "../CommunicationProvider.js";

import { isGmailConfigured, validateGmailSendInput } from "./GmailProviderValidator.js";
import { mapCommunicationMessageToGmailPayload } from "./GmailMessageMapper.js";
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export class GmailCommunicationProvider extends CommunicationProvider {
  /**
   * @param {object} [params]
   * @param {any} [params.gmailClient] - injected Gmail client for tests (must support users.messages.send)
   * @param {string} [params.nowISO] - deterministic clock for sentAt
   */
  constructor({ gmailClient = null, nowISO = null } = {}) {
    super();
    this._gmailClient = gmailClient;
    this._nowISO = nowISO;

    this._clientId = safeString(process.env.GMAIL_CLIENT_ID);
    this._clientSecret = safeString(process.env.GMAIL_CLIENT_SECRET);
    this._redirectUri = safeString(process.env.GMAIL_REDIRECT_URI);
    this._refreshToken = safeString(process.env.GMAIL_REFRESH_TOKEN);
    this._senderEmail = safeString(process.env.GMAIL_SENDER_EMAIL);

    this._oauth2Client = null;
    this._gmail = null;
  }

  get id() {
    return "gmail";
  }

  get name() {
    return "Gmail outbound email provider";
  }

  get supportedChannels() {
    return ["email"];
  }

  get health() {
    return isGmailConfigured() ? "healthy" : "not_configured";
  }

  async #connectIfNeeded() {
    if (this._gmailClient) return;
    if (this._gmail) return;

    if (!isGmailConfigured()) {
      throw new Error("GmailCommunicationProvider not_configured: missing GMAIL OAuth environment variables.");
    }

    this._oauth2Client = new google.auth.OAuth2(
      this._clientId,
      this._clientSecret,
      this._redirectUri,
    );

    this._oauth2Client.setCredentials({
      refresh_token: this._refreshToken,
    });

    this._gmail = google.gmail({ version: "v1", auth: this._oauth2Client });
  }

  async send({ message } = {}) {
    if (!message || typeof message !== "object") {
      throw new Error("GmailCommunicationProvider.send: message required.");
    }

    // Validate channel and required fields deterministically.
    validateGmailSendInput({ provider: this, message });

    // Mapper validates message structure and extracts headers.
    const payload = mapCommunicationMessageToGmailPayload(message);

    await this.#connectIfNeeded();

    const gmail = this._gmailClient ?? this._gmail;
    if (!gmail?.users?.messages?.send) {
      throw new Error("GmailCommunicationProvider.send: gmail client not available.");
    }

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: payload,
    });

    const providerMessageId = safeString(res?.data?.id ?? res?.id ?? "");
    if (!providerMessageId) {
      throw new Error("GmailCommunicationProvider.send: providerMessageId missing from Gmail response.");
    }

    const sentAt = this._nowISO ?? new Date().toISOString();

    return {
      providerMessageId,
      status: "sent",
      sentAt,
      metadata: deepFreeze({
        provider: "gmail",
        senderEmail: this._senderEmail || null,
        requestId: safeString(res?.data?.threadId ?? ""),
      }),
    };
  }
}

