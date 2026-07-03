import assert from "node:assert/strict";
import { test } from "node:test";

import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { GmailCommunicationProvider } from "./GmailCommunicationProvider.js";
import { mapCommunicationMessageToGmailPayload } from "./GmailMessageMapper.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:10:00.000Z";

function makeFrozenMessage({ channel = "email", senderEmail, recipientEmails } = {}) {
  return deepFreeze({
    id: "cm_1",
    channel,
    direction: "outbound",
    status: "queued",
    sender: {
      id: "tm_1",
      type: "human",
      name: "Sender",
      metadata: { email: senderEmail ?? "sender@example.com" },
    },
    recipients: (recipientEmails ?? ["to@example.com", "cc@example.com"]).map((e, idx) => ({
      id: `p_${idx}`,
      type: "external_system",
      name: `Recipient ${idx}`,
      metadata: { email: e },
    })),
    subject: "Subject line",
    body: "Hello from VIBETech",
    createdAt: NOW0,
    sentAt: null,
    deliveredAt: null,
    failedAt: null,
    relatedObjects: [],
    metadata: {},
    attentionRequired: false,
    badges: [],
    actions: [],
  });
}

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const prev = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const REQUIRED_ENV = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
];

test("Gmail provider contract: implements required fields", () => {
  const provider = new GmailCommunicationProvider({ gmailClient: null, nowISO: NOW1 });
  assert.equal(typeof provider.id, "string");
  assert.equal(provider.supportedChannels.length, 1);
  assert.ok(provider.supportedChannels.includes("email"));
  assert.equal(typeof provider.name, "string");
  assert.equal(typeof provider.health, "string");
  assert.equal(typeof provider.send, "function");
});

test("Message mapping: CommunicationMessage -> gmail payload raw exists", () => {
  const message = makeFrozenMessage();
  const payload = mapCommunicationMessageToGmailPayload(message);
  assert.ok(payload.raw && typeof payload.raw === "string");
  assert.ok(payload.raw.length > 10);
});

test("Missing env vars: provider health is not_configured and send fails deterministically", async () => {
  const message = makeFrozenMessage();

  await withEnv(Object.fromEntries(REQUIRED_ENV.map((k) => [k, undefined])), async () => {
    const provider = new GmailCommunicationProvider({ gmailClient: { users: { messages: { send: async () => ({ data: { id: "x" } }) } } }, nowISO: NOW1 });
    assert.equal(provider.health, "not_configured");

    await assert.rejects(() => provider.send({ message }), (err) => {
      return String(err?.message ?? err).includes("not_configured");
    });
  });
});

test("Successful mocked send: returns providerMessageId/status/sentAt/metadata and does not mutate runtime message", async () => {
  const message = makeFrozenMessage();
  const fakeGmail = {
    users: {
      messages: {
        send: async (req) => {
          assert.equal(req.userId, "me");
          assert.ok(req.requestBody?.raw);
          return { data: { id: "gmail_msg_1", threadId: "th_1" } };
        },
      },
    },
  };

  await withEnv(
    {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REDIRECT_URI: "http://localhost",
      GMAIL_REFRESH_TOKEN: "token",
      GMAIL_SENDER_EMAIL: "sender@example.com",
    },
    async () => {
      const provider = new GmailCommunicationProvider({ gmailClient: fakeGmail, nowISO: NOW1 });
      assert.equal(provider.health, "healthy");

      assert.ok(Object.isFrozen(message));
      const before = JSON.stringify(message);
      const res = await provider.send({ message });
      const after = JSON.stringify(message);

      assert.equal(after, before);
      assert.equal(res.providerMessageId, "gmail_msg_1");
      assert.equal(res.status, "sent");
      assert.equal(res.sentAt, NOW1);
      assert.ok(res.metadata && typeof res.metadata === "object");
    },
  );
});

test("Failed mocked send: provider.send throws and execution service can mark FAILED", async () => {
  const message = makeFrozenMessage();
  const fakeGmail = {
    users: {
      messages: {
        send: async () => {
          throw new Error("gmail transport failed");
        },
      },
    },
  };

  await withEnv(
    {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REDIRECT_URI: "http://localhost",
      GMAIL_REFRESH_TOKEN: "token",
      GMAIL_SENDER_EMAIL: "sender@example.com",
    },
    async () => {
      const provider = new GmailCommunicationProvider({ gmailClient: fakeGmail, nowISO: NOW1 });
      await assert.rejects(() => provider.send({ message }), /gmail transport failed/);
    },
  );
});

test("Unsupported channel: send throws for non-email messages", async () => {
  const message = makeFrozenMessage({ channel: "sms" });

  await withEnv(
    {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REDIRECT_URI: "http://localhost",
      GMAIL_REFRESH_TOKEN: "token",
      GMAIL_SENDER_EMAIL: "sender@example.com",
    },
    async () => {
      const provider = new GmailCommunicationProvider({ gmailClient: null, nowISO: NOW1 });
      await assert.rejects(() => provider.send({ message }), /message\.channel|supportedChannels|sms/i);
    },
  );
});

