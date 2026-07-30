import assert from "node:assert/strict";
import { test } from "node:test";

import { GmailIntegrationAdapter } from "./GmailIntegrationAdapter.js";
import { GmailCommunicationProvider } from "../../communications/providers/gmail/GmailCommunicationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

test("Gmail adapter advertises SEND_EMAIL and RECEIVE_EMAIL", () => {
  const adapter = new GmailIntegrationAdapter();
  assert.ok(adapter.supportedCapabilities.includes(INTEGRATION_CAPABILITIES.SEND_EMAIL));
  assert.ok(adapter.supportedCapabilities.includes(INTEGRATION_CAPABILITIES.RECEIVE_EMAIL));
});

test("executeAction RECEIVE_EMAIL lists inbox via the resolved provider", async () => {
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: [{ id: "m1", threadId: "t1" }], resultSizeEstimate: 1 } }),
      },
    },
  };
  const provider = new GmailCommunicationProvider({ gmailClient: fakeGmail, refreshToken: "rt" });
  const adapter = new GmailIntegrationAdapter({ gmailCommunicationProvider: provider });

  const result = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.RECEIVE_EMAIL, parameters: { maxResults: 5 } },
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(result.metadata.messages, [{ id: "m1", threadId: "t1" }]);
});

test("resolveProvider uses vault credentials when a credentialResolver resolves them", () => {
  const provider = new GmailCommunicationProvider({});
  const adapter = new GmailIntegrationAdapter({ gmailCommunicationProvider: provider });
  const connection = { credentialReference: { credentialId: "cred_1" } };
  const credentialResolver = {
    resolve: () => ({ refreshToken: "rt_123", senderEmail: "owner@business.example" }),
  };

  const resolved = adapter.resolveProvider({ connection, credentialResolver });
  assert.notEqual(resolved, provider);
  assert.equal(resolved.senderEmail, "owner@business.example");
});

test("resolveProvider falls back to the default provider without vault credentials", () => {
  const provider = new GmailCommunicationProvider({});
  const adapter = new GmailIntegrationAdapter({ gmailCommunicationProvider: provider });
  assert.equal(adapter.resolveProvider({ connection: null, credentialResolver: null }), provider);
});
