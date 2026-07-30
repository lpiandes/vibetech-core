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

function fromBase64Url(str) {
  if (!str) return "";
  const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Walk a Gmail message payload (which may be a single part or a MIME tree)
 * and return the best-effort plain-text body, preferring text/plain over text/html.
 */
function extractBody(payload) {
  if (!payload || typeof payload !== "object") return "";

  let plain = null;
  let html = null;

  function visit(part) {
    if (!part) return;
    const mimeType = safeString(part.mimeType).toLowerCase();
    const data = part.body?.data;
    if (mimeType === "text/plain" && data && plain === null) {
      plain = fromBase64Url(data);
    } else if (mimeType === "text/html" && data && html === null) {
      html = fromBase64Url(data);
    } else if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        visit(child);
        if (plain !== null) break;
      }
    } else if (!mimeType.startsWith("multipart/") && data && plain === null && html === null) {
      // Single-part message without an explicit text/plain mimeType.
      plain = fromBase64Url(data);
    }
  }

  visit(payload);
  if (plain !== null) return plain.trim();
  if (html !== null) return stripHtml(html);
  return "";
}

function headerValue(headers, name) {
  const target = String(name).toLowerCase();
  const found = (Array.isArray(headers) ? headers : []).find(
    (h) => safeString(h?.name).toLowerCase() === target,
  );
  return found ? safeString(found.value) : "";
}

/**
 * Parse an email address header like `"Jane Doe" <jane@example.com>, other@example.com`
 * into `[{ name, email }]`.
 */
function parseAddressList(headerText) {
  const text = safeString(headerText);
  if (!text) return [];
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.map((part) => {
    const match = part.match(/^(.*?)<([^<>]+)>$/);
    if (match) {
      const name = match[1].trim().replace(/^"|"$/g, "");
      return { name: name || null, email: match[2].trim().toLowerCase() };
    }
    return { name: null, email: part.trim().toLowerCase() };
  }).filter((p) => p.email.includes("@"));
}

/**
 * Map a raw Gmail API message resource (format=full) into a plain, storage-friendly
 * inbound record. Never throws on missing/odd fields — Gmail messages are attacker-
 * controlled input.
 */
export function mapGmailMessageToInboundRecord(gmailMessage = {}) {
  const headers = gmailMessage?.payload?.headers ?? [];
  const fromList = parseAddressList(headerValue(headers, "From"));
  const toList = parseAddressList(headerValue(headers, "To"));
  const dateHeader = headerValue(headers, "Date");
  const internalDateMs = Number(gmailMessage?.internalDate ?? NaN);
  const receivedAt = Number.isFinite(internalDateMs)
    ? new Date(internalDateMs).toISOString()
    : (dateHeader ? new Date(dateHeader).toISOString() : null);

  return {
    gmailMessageId: safeString(gmailMessage?.id),
    threadId: safeString(gmailMessage?.threadId),
    rfcMessageId: headerValue(headers, "Message-ID") || headerValue(headers, "Message-Id"),
    from: fromList[0] ?? null,
    to: toList,
    subject: headerValue(headers, "Subject"),
    date: dateHeader || null,
    receivedAt,
    snippet: safeString(gmailMessage?.snippet),
    body: extractBody(gmailMessage?.payload),
    labelIds: Array.isArray(gmailMessage?.labelIds) ? gmailMessage.labelIds.map(safeString) : [],
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

