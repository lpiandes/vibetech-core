import assert from "node:assert/strict";
import { test } from "node:test";

import { mapGmailMessageToInboundRecord } from "./GmailMessageMapper.js";

function b64url(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function makeGmailMessage({
  id = "gm_1",
  threadId = "th_1",
  from = '"Jane Doe" <jane@example.com>',
  to = "owner@business.example",
  subject = "Question about pricing",
  date = "Wed, 30 Jul 2026 10:00:00 -0400",
  bodyText = "Hi, what does the premium plan include?",
  htmlOnly = false,
} = {}) {
  const headers = [
    { name: "From", value: from },
    { name: "To", value: to },
    { name: "Subject", value: subject },
    { name: "Date", value: date },
    { name: "Message-ID", value: "<abc123@mail.gmail.com>" },
  ];

  const payload = htmlOnly
    ? { mimeType: "text/html", body: { data: b64url(`<p>${bodyText}</p>`) }, headers }
    : { mimeType: "text/plain", body: { data: b64url(bodyText) }, headers };

  return {
    id,
    threadId,
    snippet: bodyText.slice(0, 40),
    internalDate: String(Date.parse(date)),
    labelIds: ["INBOX", "UNREAD"],
    payload,
  };
}

test("maps a simple plain-text Gmail message into an inbound record", () => {
  const record = mapGmailMessageToInboundRecord(makeGmailMessage());
  assert.equal(record.gmailMessageId, "gm_1");
  assert.equal(record.threadId, "th_1");
  assert.equal(record.subject, "Question about pricing");
  assert.equal(record.from?.email, "jane@example.com");
  assert.equal(record.from?.name, "Jane Doe");
  assert.equal(record.to[0]?.email, "owner@business.example");
  assert.match(record.body, /premium plan/);
  assert.ok(record.receivedAt);
  assert.ok(record.labelIds.includes("UNREAD"));
});

test("falls back to stripped HTML body when no text/plain part exists", () => {
  const record = mapGmailMessageToInboundRecord(makeGmailMessage({ htmlOnly: true, bodyText: "Plain via html" }));
  assert.match(record.body, /Plain via html/);
  assert.ok(!record.body.includes("<p>"));
});

test("parses multipart/alternative payloads, preferring text/plain", () => {
  const headers = [
    { name: "From", value: "sender@example.com" },
    { name: "Subject", value: "Multipart" },
  ];
  const gmailMessage = {
    id: "gm_2",
    threadId: "th_2",
    payload: {
      mimeType: "multipart/alternative",
      headers,
      parts: [
        { mimeType: "text/plain", body: { data: b64url("Plain body") } },
        { mimeType: "text/html", body: { data: b64url("<b>Html body</b>") } },
      ],
    },
  };
  const record = mapGmailMessageToInboundRecord(gmailMessage);
  assert.equal(record.body, "Plain body");
  assert.equal(record.from.email, "sender@example.com");
});

test("never throws on malformed/missing fields", () => {
  assert.doesNotThrow(() => mapGmailMessageToInboundRecord({}));
  assert.doesNotThrow(() => mapGmailMessageToInboundRecord(null));
  const record = mapGmailMessageToInboundRecord({});
  assert.equal(record.gmailMessageId, "");
  assert.equal(record.from, null);
  assert.equal(record.body, "");
});
