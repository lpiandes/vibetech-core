import { google } from "googleapis";

import { CommunicationProvider } from "../CommunicationProvider.js";

import { isGmailConfigured, validateGmailSendInput } from "./GmailProviderValidator.js";
import { mapCommunicationMessageToGmailPayload, mapGmailMessageToInboundRecord } from "./GmailMessageMapper.js";
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { createGoogleAuthedClient, getGoogleOAuthAppConfig } from "../../../integrations/oauth/GoogleOAuthClient.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeMessageArg(messageOrOpts) {
  if (!messageOrOpts) return null;
  if (messageOrOpts.message && typeof messageOrOpts.message === "object") return messageOrOpts.message;
  return messageOrOpts;
}

export class GmailCommunicationProvider extends CommunicationProvider {
  /**
   * @param {object} [params]
   * @param {any} [params.gmailClient] - injected Gmail client for tests
   * @param {string} [params.nowISO]
   * @param {string} [params.refreshToken] - per-business vault refresh token
   * @param {string} [params.accessToken]
   * @param {string} [params.senderEmail]
   */
  constructor({
    gmailClient = null,
    nowISO = null,
    refreshToken = null,
    accessToken = null,
    senderEmail = null,
  } = {}) {
    super();
    this._gmailClient = gmailClient;
    this._nowISO = nowISO;

    const app = getGoogleOAuthAppConfig();
    this._clientId = app.clientId || safeString(process.env.GMAIL_CLIENT_ID);
    this._clientSecret = app.clientSecret || safeString(process.env.GMAIL_CLIENT_SECRET);
    this._redirectUri = app.redirectUri || safeString(process.env.GMAIL_REDIRECT_URI);
    this._refreshToken = safeString(refreshToken ?? process.env.GMAIL_REFRESH_TOKEN);
    this._accessToken = safeString(accessToken);
    this._senderEmail = safeString(senderEmail ?? process.env.GMAIL_SENDER_EMAIL);

    this._oauth2Client = null;
    this._gmail = null;
  }

  withCredentials({ refreshToken, accessToken = null, senderEmail = null } = {}) {
    return new GmailCommunicationProvider({
      gmailClient: this._gmailClient,
      nowISO: this._nowISO,
      refreshToken: refreshToken ?? this._refreshToken,
      accessToken: accessToken ?? this._accessToken,
      senderEmail: senderEmail ?? this._senderEmail,
    });
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
    // Injected client + vault refresh token is enough for execution tests / live sends.
    if (this._gmailClient && this._refreshToken) return "healthy";
    if (this._refreshToken && this._clientId && this._clientSecret) return "healthy";
    return isGmailConfigured() ? "healthy" : "not_configured";
  }

  get senderEmail() {
    return this._senderEmail || null;
  }

  async #connectIfNeeded() {
    if (this._gmailClient) return;
    if (this._gmail) return;

    if (this.health === "not_configured") {
      throw new Error("GmailCommunicationProvider not_configured: missing Gmail OAuth credentials.");
    }

    if (this._refreshToken) {
      this._oauth2Client = createGoogleAuthedClient({
        refreshToken: this._refreshToken,
        accessToken: this._accessToken || null,
      });
    } else {
      this._oauth2Client = new google.auth.OAuth2(
        this._clientId,
        this._clientSecret,
        this._redirectUri,
      );
      this._oauth2Client.setCredentials({
        refresh_token: safeString(process.env.GMAIL_REFRESH_TOKEN),
      });
    }

    this._gmail = google.gmail({ version: "v1", auth: this._oauth2Client });
  }

  /**
   * Accepts a CommunicationMessage, or `{ message }` for IntegrationProvider callers.
   */
  async send(messageOrOpts) {
    const message = normalizeMessageArg(messageOrOpts);
    if (!message || typeof message !== "object") {
      throw new Error("GmailCommunicationProvider.send: message required.");
    }

    // Ensure From is present for Gmail API — prefer vault sender identity.
    const enriched = ensureSenderEmail(message, this._senderEmail);

    validateGmailSendInput({ provider: this, message: enriched, requireEnvConfig: false });

    const payload = mapCommunicationMessageToGmailPayload(enriched);

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

  /**
   * List recent inbox messages (metadata only; use getMessage for full parsed body).
   * Requires the gmail.readonly OAuth scope on the connected account — will fail with
   * an insufficient-scope error from Gmail if the business connected before that scope
   * was requested (needs reconnect).
   * @param {{query?: string, maxResults?: number, pageToken?: string}} [opts]
   */
  async listInbox({ query = "in:inbox", maxResults = 25, pageToken = null } = {}) {
    await this.#connectIfNeeded();
    const gmail = this._gmailClient ?? this._gmail;
    if (!gmail?.users?.messages?.list) {
      throw new Error("GmailCommunicationProvider.listInbox: gmail client not available.");
    }
    const res = await gmail.users.messages.list({
      userId: "me",
      q: safeString(query) || undefined,
      maxResults: Math.max(1, Math.min(100, Number(maxResults) || 25)),
      pageToken: pageToken || undefined,
    });
    const ids = Array.isArray(res?.data?.messages) ? res.data.messages : [];
    return {
      messages: ids.map((m) => ({ id: safeString(m.id), threadId: safeString(m.threadId) })),
      nextPageToken: safeString(res?.data?.nextPageToken ?? "") || null,
      resultSizeEstimate: res?.data?.resultSizeEstimate ?? ids.length,
    };
  }

  /**
   * Fetch and parse one message in full (headers + body).
   * @param {string} id - Gmail message id
   */
  async getMessage(id) {
    const messageId = safeString(id);
    if (!messageId) throw new Error("GmailCommunicationProvider.getMessage: id required.");
    await this.#connectIfNeeded();
    const gmail = this._gmailClient ?? this._gmail;
    if (!gmail?.users?.messages?.get) {
      throw new Error("GmailCommunicationProvider.getMessage: gmail client not available.");
    }
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    return mapGmailMessageToInboundRecord(res?.data ?? {});
  }

  /**
   * Incremental sync via Gmail history API. Only usable once a prior historyId is known
   * (Gmail expires history ids after ~a week of inactivity — callers should fall back to
   * listInbox + getMessage when this throws).
   * @param {string} startHistoryId
   */
  async getHistory(startHistoryId) {
    const start = safeString(startHistoryId);
    if (!start) throw new Error("GmailCommunicationProvider.getHistory: startHistoryId required.");
    await this.#connectIfNeeded();
    const gmail = this._gmailClient ?? this._gmail;
    if (!gmail?.users?.history?.list) {
      throw new Error("GmailCommunicationProvider.getHistory: gmail client not available.");
    }
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId: start,
      historyTypes: ["messageAdded"],
    });
    const history = Array.isArray(res?.data?.history) ? res.data.history : [];
    const addedIds = new Set();
    for (const entry of history) {
      for (const added of entry.messagesAdded ?? []) {
        if (added?.message?.id) addedIds.add(safeString(added.message.id));
      }
    }
    return {
      historyId: safeString(res?.data?.historyId ?? start),
      addedMessageIds: [...addedIds],
    };
  }
}

function ensureSenderEmail(message, senderEmail) {
  const email = safeString(senderEmail).trim();
  if (!email) return message;
  const existing = message.sender?.metadata?.email || message.sender?.email;
  if (existing) return message;
  return {
    ...message,
    sender: {
      ...(message.sender && typeof message.sender === "object" ? message.sender : { id: "business", type: "system" }),
      metadata: {
        ...((message.sender && message.sender.metadata) || {}),
        email,
      },
    },
  };
}
