import { COMMUNICATION_CHANNELS } from "../../CommunicationChannel.js";

function fail(message) {
  throw new Error(`GmailMessageMapper: ${message}`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function toBase64Url(str) {
  const b64 = Buffer.from(str).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function extractEmail(participant) {
  if (!participant || typeof participant !== "object") return null;

  // Expected (canonical within this project): participant.metadata.email
  const md = participant.metadata ?? {};
  const email =
    (participant.email && safeString(participant.email)) ||
    (participant.address && safeString(participant.address)) ||
    (md.email && safeString(md.email)) ||
    null;

  const trimmed = email ? String(email).trim() : "";
  if (!trimmed) return null;
  // Very light sanity check.
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

export function mapCommunicationMessageToGmailPayload(message) {
  if (!message || typeof message !== "object") fail("message required.");

  const channel = safeString(message.channel);
  if (channel !== "email") fail(`message.channel must be email, got: ${channel}`);

  const sender = message.sender;
  const recipients = Array.isArray(message.recipients) ? message.recipients : [];

  const fromEmail = extractEmail(sender);
  if (!fromEmail) fail("sender email is required in sender.metadata.email.");

  const toEmails = recipients
    .map((r) => extractEmail(r))
    .filter((x) => Boolean(x));

  if (!toEmails.length) fail("at least one recipient email is required in recipients[].metadata.email.");

  const subject = safeString(message.subject);
  if (!subject) fail("message.subject required.");

  // CommunicationMessage stores the outbound content in `body`.
  const body = safeString(message.body);
  if (!body) fail("message.body required.");

  const messageLines = [
    `From: ${fromEmail}`,
    `To: ${toEmails.join(", ")}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ];

  const raw = toBase64Url(messageLines.join("\n"));

  return {
    raw,
  };
}

export function validateCommunicationMessageForGmail(message) {
  if (!message || typeof message !== "object") fail("message required.");
  const channel = safeString(message.channel);
  if (channel !== "email") fail(`channel must be email, got: ${channel}`);

  const fromEmail = extractEmail(message.sender);
  if (!fromEmail) fail("sender email required.");

  const recipients = Array.isArray(message.recipients) ? message.recipients : [];
  const toEmails = recipients.map((r) => extractEmail(r)).filter(Boolean);
  if (!toEmails.length) fail("recipients email required.");

  const subject = safeString(message.subject);
  if (!subject) fail("subject required.");

  const body = safeString(message.body);
  if (!body) fail("body required.");

  if (!COMMUNICATION_CHANNELS.includes("email")) {
    // Defensive; should never happen.
    fail("canonical communication channel contract missing email.");
  }

  return { ok: true };
}

