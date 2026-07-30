import assert from "node:assert/strict";
import { test } from "node:test";

import { GmailInboundSyncService } from "./GmailInboundSyncService.js";
import { readGmailInboxState, readGmailInboxSyncState } from "./GmailInboxStore.js";

function makeFakePlatformStore() {
  return {
    installation: null,
    upsertCalls: 0,
    async upsertBusinessOSInstallation(payload) {
      this.upsertCalls += 1;
      this.installation = {
        ...this.installation,
        ...payload,
        configuration: { ...(this.installation?.configuration ?? {}), ...(payload.configuration ?? {}) },
      };
      return this.installation;
    },
  };
}

function baseInstallation() {
  return {
    id: "install_biz_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: {},
  };
}

function makeFakeProvider({ health = "healthy", messagesByPage = [], messagesById = {} } = {}) {
  let call = 0;
  return {
    health,
    listInboxCalls: 0,
    getMessageCalls: [],
    async listInbox() {
      this.listInboxCalls += 1;
      const page = messagesByPage[call] ?? messagesByPage[messagesByPage.length - 1] ?? [];
      call += 1;
      return { messages: page.map((id) => ({ id, threadId: `thread_${id}` })), nextPageToken: null };
    },
    async getMessage(id) {
      this.getMessageCalls.push(id);
      const record = messagesById[id];
      if (!record) throw new Error(`no fixture for ${id}`);
      return record;
    },
  };
}

function fixtureMessage({ id, threadId, email, name, subject = "Hello", body = "Body text" }) {
  return {
    gmailMessageId: id,
    threadId,
    rfcMessageId: `<${id}@mail.gmail.com>`,
    from: { email, name },
    to: [{ email: "owner@business.example", name: null }],
    subject,
    date: "Wed, 30 Jul 2026 10:00:00 -0400",
    receivedAt: "2026-07-30T14:00:00.000Z",
    snippet: body.slice(0, 20),
    body,
    labelIds: ["INBOX"],
  };
}

test("syncs new inbox messages: fetches, matches/creates people, dedups by gmail id", async () => {
  const platformStore = makeFakePlatformStore();
  const installation = baseInstallation();
  const provider = makeFakeProvider({
    messagesByPage: [["m1", "m2"]],
    messagesById: {
      m1: fixtureMessage({ id: "m1", threadId: "t1", email: "jane@example.com", name: "Jane Doe" }),
      m2: fixtureMessage({ id: "m2", threadId: "t2", email: "sam@example.com", name: "Sam Roe" }),
    },
  });

  const service = new GmailInboundSyncService({ nowISO: () => "2026-07-30T14:05:00.000Z" });
  const result = await service.sync({
    businessId: "biz_1",
    platformStore,
    installation,
    provider,
    maxResults: 10,
  });

  assert.equal(result.ok, true);
  assert.equal(result.fetched, 2);
  assert.equal(result.added, 2);
  assert.equal(result.contactsCreated, 2);
  assert.equal(result.contactsMatched, 0);
  assert.equal(provider.getMessageCalls.length, 2);

  const inbox = readGmailInboxState(platformStore.installation);
  assert.equal(inbox.messages.length, 2);
  assert.ok(inbox.messages.every((m) => m.personId));

  const sync = readGmailInboxSyncState(platformStore.installation);
  assert.equal(sync.lastSyncOk, true);
  assert.equal(sync.messageCount, 2);

  const crm = platformStore.installation.configuration.crm;
  assert.equal(crm.contacts.length, 2);
  assert.ok(crm.contacts.some((c) => c.email === "jane@example.com"));
});

test("second sync dedups already-stored gmail message ids (no re-fetch)", async () => {
  const platformStore = makeFakePlatformStore();
  const installation = baseInstallation();
  const provider = makeFakeProvider({
    messagesByPage: [["m1"]],
    messagesById: {
      m1: fixtureMessage({ id: "m1", threadId: "t1", email: "jane@example.com", name: "Jane Doe" }),
    },
  });
  const service = new GmailInboundSyncService();

  const first = await service.sync({ businessId: "biz_1", platformStore, installation, provider });
  assert.equal(first.added, 1);

  const second = await service.sync({
    businessId: "biz_1",
    platformStore,
    installation: platformStore.installation,
    provider,
  });
  assert.equal(second.ok, true);
  assert.equal(second.fetched, 0);
  assert.equal(second.added, 0);
  assert.equal(second.skippedAlreadySynced, 1);
  assert.equal(provider.getMessageCalls.length, 1, "getMessage should not be called again for an already-synced id");

  const inbox = readGmailInboxState(platformStore.installation);
  assert.equal(inbox.messages.length, 1);
});

test("second message from a previously-seen sender matches (not create) an existing contact", async () => {
  const platformStore = makeFakePlatformStore();
  const installation = baseInstallation();
  const provider = makeFakeProvider({
    messagesByPage: [["m1"], ["m2"]],
    messagesById: {
      m1: fixtureMessage({ id: "m1", threadId: "t1", email: "jane@example.com", name: "Jane Doe" }),
      m2: fixtureMessage({ id: "m2", threadId: "t1", email: "jane@example.com", name: "Jane Doe", subject: "Follow-up" }),
    },
  });
  const service = new GmailInboundSyncService();

  await service.sync({ businessId: "biz_1", platformStore, installation, provider });
  const second = await service.sync({
    businessId: "biz_1",
    platformStore,
    installation: platformStore.installation,
    provider,
  });

  assert.equal(second.contactsCreated, 0);
  assert.equal(second.contactsMatched, 1);
  const crm = platformStore.installation.configuration.crm;
  assert.equal(crm.contacts.length, 1, "same sender email should not create a duplicate contact");
});

test("missing readonly scope surfaces a clear reconnect reason and records sync failure", async () => {
  const platformStore = makeFakePlatformStore();
  const installation = baseInstallation();
  const provider = {
    health: "healthy",
    async listInbox() {
      throw new Error("Insufficient Permission: request had insufficient authentication scopes");
    },
  };
  const service = new GmailInboundSyncService();
  const result = await service.sync({ businessId: "biz_1", platformStore, installation, provider });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_readonly_scope");
  assert.match(result.message, /reconnect/i);

  const sync = readGmailInboxSyncState(platformStore.installation);
  assert.equal(sync.lastSyncOk, false);
  assert.match(sync.lastSyncError, /Insufficient Permission/);
});

test("not-configured provider fails fast without listing/fetching", async () => {
  const platformStore = makeFakePlatformStore();
  const installation = baseInstallation();
  const provider = makeFakeProvider({ health: "not_configured" });
  const service = new GmailInboundSyncService();

  const result = await service.sync({ businessId: "biz_1", platformStore, installation, provider });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "gmail_not_connected");
  assert.equal(provider.listInboxCalls, 0);
});
