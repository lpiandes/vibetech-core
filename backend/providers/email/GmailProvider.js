import { google } from "googleapis";

import { EmailProvider } from "./EmailProvider.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`GmailProvider: missing required env var ${name}`);
  }
  return v.trim();
}

function toBase64Url(str) {
  const b64 = Buffer.from(str).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * GmailProvider
 *
 * Responsibilities:
 * - OAuth connect
 * - Execute outbound email send using Gmail API
 * - Return provider message id + status + timestamp
 *
 * Does NOT update runtime directly.
 */
export class GmailProvider extends EmailProvider {
  constructor() {
    super();
    this.clientId = requiredEnv("GMAIL_CLIENT_ID");
    this.clientSecret = requiredEnv("GMAIL_CLIENT_SECRET");
    this.redirectUri = requiredEnv("GMAIL_REDIRECT_URI");
    this.refreshToken = requiredEnv("GMAIL_REFRESH_TOKEN");
    this.senderEmail = requiredEnv("GMAIL_SENDER_EMAIL");

    /** @type {import("googleapis").gmail_v1.Gmail | null} */
    this.gmail = null;
    this.oauth2Client = null;
  }

  async connect() {
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );

    this.oauth2Client.setCredentials({
      refresh_token: this.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  async health() {
    // Lightweight: if connect has succeeded, consider healthy.
    return { ok: Boolean(this.gmail) };
  }

  async disconnect() {
    this.gmail = null;
    this.oauth2Client = null;
  }

  async send({ communication } = {}) {
    if (!this.gmail) {
      await this.connect();
    }

    const recipient = communication?.recipient;
    const subject = communication?.subject;
    const body = communication?.body;

    if (typeof recipient !== "string" || recipient.trim().length === 0) {
      throw new Error("GmailProvider.send: communication.recipient required.");
    }
    if (typeof subject !== "string") {
      throw new Error("GmailProvider.send: communication.subject required.");
    }
    if (typeof body !== "string") {
      throw new Error("GmailProvider.send: communication.body required.");
    }

    const messageLines = [
      `From: ${this.senderEmail}`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      "",
      body,
    ];

    const raw = toBase64Url(messageLines.join("\n"));

    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    const providerMessageId = res?.data?.id;
    const providerStatus = "SENT";
    const sentTimestamp = new Date().toISOString();

    return { providerMessageId, providerStatus, sentTimestampISO: sentTimestamp, sentTimestamp };
  }
}

